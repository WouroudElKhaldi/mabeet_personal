import type { BookingStatus } from "@prisma/client";
import { bookingReference, secureToken } from "@/lib/tokens";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isOverlapError, prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as offerings from "@/server/repositories/offering-repository";
import { recordAction } from "./audit";
import { presentForStaff } from "./booking-service";
import { assertTransition } from "./booking-status";
import { notifyBookingRequested, notifyBookingStatus, notifyGuestCancelled } from "./notification-service";

// Seats in a dated session of an experience or service. Same lifecycle as a room booking:
// HELD on request (the seats are taken at once), then the host confirms or declines.

const SEATS_TAKEN = "Those seats were just taken. Please pick another time.";
const HOUR_MS = 3_600_000;

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

  try {
    const booking = await runInTransaction(async (tx) => {
      if (!(await offerings.lockOpenSession(tx, offering.id, request.sessionId))) throw notFound("Session");
      const session = await tx.offeringSession.findUniqueOrThrow({
        where: { id: request.sessionId },
        include: { business: { select: { holdHours: true } } },
      });
      const quote = quoteSession(offering, request.seats, offering.business.depositPercent);
      // The hold never outlasts the session itself.
      const holdEnds = Math.min(
        now.getTime() + session.business.holdHours * HOUR_MS,
        session.startsAt.getTime(),
      );
      const held = await offerings.createHeldSessionBooking(tx, {
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
        holdExpiresAt: new Date(holdEnds),
      });
      await logActivity(tx, {
        userId: request.guestUserId,
        businessId: offering.business.id,
        action: "booking.requested",
        entity: "session_booking",
        entityId: held.id,
      });
      return held;
    });
    notifyBookingRequested(booking.id, "session");
    return booking;
  } catch (error) {
    if (isOverlapError(error)) throw conflict(SEATS_TAKEN);
    throw error;
  }
}

async function decide(
  ctx: TenantContext,
  bookingId: string,
  status: BookingStatus,
  now: Date,
  reason?: string,
) {
  requirePermission(ctx, "bookings.decide");
  const booking = await runInTransaction(async (tx) => {
    const current = await offerings.findSessionBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    assertTransition(current.status, status);
    if (status === "CONFIRMED") {
      if (current.holdExpiresAt && current.holdExpiresAt < now) {
        throw conflict("This hold has expired. Ask the guest to request again.");
      }
      if (current.session.startsAt < now) throw conflict("This session has already started.");
    }
    return offerings.changeSessionBookingStatus(tx, ctx.businessId, bookingId, {
      status,
      decidedById: ctx.userId,
      cancelReason: reason,
    });
  });
  await recordAction(ctx, `booking.${status.toLowerCase()}`, "session_booking", bookingId);
  notifyBookingStatus(bookingId, "session");
  return booking;
}

export const confirmSessionBooking = (ctx: TenantContext, bookingId: string, now = new Date()) =>
  decide(ctx, bookingId, "CONFIRMED", now);
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
  const booking = await runInTransaction(async (tx) => {
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
    return updated;
  });
  if (booking) {
    notifyBookingStatus(booking.id, "session");
    notifyGuestCancelled(booking.id, "session");
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
