import type { BookingStatus } from "@prisma/client";
import { bookingReference, secureToken } from "@/lib/tokens";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as offerings from "@/server/repositories/offering-repository";
import { recordAction } from "./audit";
import { overlapAsConflict } from "./constraint-errors";
import { presentForStaff } from "./booking-service";
import { assertTransition } from "./booking-status";
import {
  PAY_AFTER_ACCEPT_HOURS,
  holdUntil,
  initialStatus,
  onlineDue,
  statusOnAccept,
} from "./booking-policy";
import {
  notifyBookingRequested,
  notifyBookingStatus,
  notifyGuestCancelled,
  notifyHostsNewBooking,
} from "./notification-service";
import { type EndedBooking, refundForEndedBooking } from "./online-payment-service";

// Seats in a dated session of an experience or service. Same lifecycle as a room booking: the seats are
// taken at once (HELD on request, or straight to AWAITING_PAYMENT / CONFIRMED for an instant booking).

const SEATS_TAKEN = "Those seats were just taken. Please pick another time.";
const HOUR_MS = 3_600_000;

const endedSession = (
  booking: Pick<EndedBooking, "id" | "refundPolicy" | "onlineDueCents">,
  startsAt: Date,
): EndedBooking => ({ kind: "session", startsAt, ...booking });

export interface SessionBookingRequest {
  offeringSlug: string;
  sessionId: string;
  seats: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  guestUserId: string | null;
  locale?: string;
}

/** What a stay of `seats` costs: per person or once for the group, and the deposit. */
function quoteSession(
  offering: { priceCents: number; priceUnit: "PER_PERSON" | "PER_GROUP" },
  seats: number,
  depositPercent: number,
) {
  const totalCents = offering.priceUnit === "PER_PERSON" ? offering.priceCents * seats : offering.priceCents;
  return { totalCents, depositCents: Math.ceil((totalCents * depositPercent) / 100) };
}

/**
 * Takes seats in a session. The session row is locked and a database trigger refuses any insert that
 * would exceed its capacity, so when people race for the last seats exactly the ones that fit get them.
 */
export async function requestSessionBooking(request: SessionBookingRequest, now = new Date()) {
  const offering = await offerings.findPublicOffering(prisma, request.offeringSlug);
  if (!offering) throw notFound("Experience");
  if (request.seats > offering.maxGuests)
    throw invalid(`Up to ${offering.maxGuests} guests can book together`);

  const booking = await overlapAsConflict(SEATS_TAKEN, () =>
    runInTransaction(async (tx) => {
      if (!(await offerings.lockOpenSession(tx, offering.id, request.sessionId))) throw notFound("Session");
      const session = await offerings.findSessionForBooking(tx, request.sessionId);
      const quote = quoteSession(offering, request.seats, offering.business.depositPercent);
      const status = initialStatus(offering.business);
      // The hold never outlasts the session itself.
      const hold = holdUntil(status, session.business.holdHours, now);
      const holdEnds = hold && new Date(Math.min(hold.getTime(), session.startsAt.getTime()));
      const created = await offerings.createSessionBooking(tx, {
        businessId: offering.business.id,
        offeringId: offering.id,
        sessionId: session.id,
        guestUserId: request.guestUserId,
        guestName: request.guestName,
        guestPhone: request.guestPhone,
        guestEmail: request.guestEmail,
        guestNote: request.guestNote,
        locale: request.locale,
        seats: request.seats,
        ...quote,
        currency: offering.business.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        status,
        holdExpiresAt: holdEnds,
        onlineDueCents: onlineDue(offering.business, quote),
        refundPolicy: offering.business.refundPolicy,
      });
      await logActivity(tx, {
        userId: request.guestUserId,
        businessId: offering.business.id,
        action: "booking.requested",
        entity: "session_booking",
        entityId: created.id,
      });
      return created;
    }),
  );
  if (booking.status === "HELD") {
    notifyBookingRequested(booking.id, "session");
  } else {
    notifyBookingStatus(booking.id, "session");
    notifyHostsNewBooking(booking.id, "session");
  }
  return booking;
}

async function decide(
  ctx: TenantContext,
  bookingId: string,
  status: BookingStatus,
  now: Date,
  reason?: string,
) {
  requirePermission(ctx, "bookings.decide");
  const { booking, startsAt } = await runInTransaction(async (tx) => {
    const current = await offerings.findSessionBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    assertTransition(current.status, status);
    if (status === "CONFIRMED" || status === "AWAITING_PAYMENT") {
      if (current.holdExpiresAt && current.holdExpiresAt < now) {
        throw conflict("This hold has expired. Ask the guest to request again.");
      }
      if (current.session.startsAt < now) throw conflict("This session has already started.");
    }
    const payBy = new Date(
      Math.min(now.getTime() + PAY_AFTER_ACCEPT_HOURS * HOUR_MS, current.session.startsAt.getTime()),
    );
    const updated = await offerings.changeSessionBookingStatus(tx, ctx.businessId, bookingId, {
      status,
      decidedById: ctx.userId,
      decidedAt: now,
      cancelReason: reason,
      ...(status === "AWAITING_PAYMENT" && { holdExpiresAt: payBy }),
    });
    return { booking: updated, startsAt: current.session.startsAt };
  });
  await recordAction(ctx, `booking.${status.toLowerCase()}`, "session_booking", bookingId);
  notifyBookingStatus(bookingId, "session");
  if (status === "DECLINED" || status === "CANCELLED") {
    await refundForEndedBooking(endedSession(booking, startsAt), "host", now);
  }
  return booking;
}

/** The host accepts: confirmed, or waiting for the guest's online payment when the host collects online. */
export async function confirmSessionBooking(ctx: TenantContext, bookingId: string, now = new Date()) {
  requirePermission(ctx, "bookings.decide");
  const current = await offerings.findSessionBooking(prisma, ctx.businessId, bookingId);
  if (!current) throw notFound("Booking");
  return decide(ctx, bookingId, statusOnAccept(current.onlineDueCents), now);
}
export const declineSessionBooking = (ctx: TenantContext, bookingId: string, reason?: string) =>
  decide(ctx, bookingId, "DECLINED", new Date(), reason);
export const cancelSessionBooking = (ctx: TenantContext, bookingId: string, reason?: string) =>
  decide(ctx, bookingId, "CANCELLED", new Date(), reason);

export async function listSessionBookings(
  ctx: TenantContext,
  filters: { status?: BookingStatus; take: number },
) {
  requirePermission(ctx, "bookings.read");
  const rows = await offerings.listSessionBookings(prisma, ctx.businessId, filters);
  return rows.map((booking) => presentForStaff(ctx, booking));
}

/** The guest cancels seats through their private link: while held or confirmed, and before the session starts. */
export async function cancelSessionAsGuest(publicToken: string, reason: string | null, now = new Date()) {
  const result = await runInTransaction(async (tx) => {
    const current = await offerings.findSessionBookingByToken(tx, publicToken);
    if (!current) return null;
    assertTransition(current.status, "CANCELLED");
    if (current.session.startsAt <= now) throw conflict("This session has already started.");
    const updated = await offerings.changeSessionBookingStatus(tx, current.businessId, current.id, {
      status: "CANCELLED",
      cancelReason: reason ?? undefined,
    });
    await logActivity(tx, {
      userId: current.guestUserId,
      businessId: current.businessId,
      action: "booking.cancelled_by_guest",
      entity: "session_booking",
      entityId: current.id,
    });
    return { booking: updated, startsAt: current.session.startsAt };
  });
  const booking = result?.booking ?? null;
  if (result && booking) {
    notifyBookingStatus(booking.id, "session");
    notifyGuestCancelled(booking.id, "session");
    await refundForEndedBooking(endedSession(booking, result.startsAt), "guest", now);
  }
  return booking;
}

export function getSessionBookingForGuest(publicToken: string) {
  return offerings.findSessionBookingByToken(prisma, publicToken);
}

export function listMySessionBookings(userId: string) {
  return offerings.listGuestSessionBookings(prisma, userId);
}

/** Cron: expires unanswered session holds and tells each guest. Returns how many expired. */
export async function expireAllStaleSessionHolds(now = new Date()) {
  const ids = await offerings.expireStaleSessionHolds(prisma, now);
  ids.forEach((id) => notifyBookingStatus(id, "session"));
  return ids.length;
}
