import type { Booking, BookingStatus } from "@prisma/client";
import { addDays, countNights, type DateRange, todayUtc } from "@/lib/dates";
import { maskEmail, maskPhone } from "@/lib/privacy";
import { bookingReference, secureToken } from "@/lib/tokens";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as bookings from "@/server/repositories/booking-repository";
import { findActiveBusinessBySlug } from "@/server/repositories/business-repository";
import {
  findRateOverrides,
  findRoom,
  hasWholePlaceUnit,
  lockActiveRoom,
  lockBookableRoom,
  lockBusinessForBooking,
} from "@/server/repositories/room-repository";
import { assertTransition } from "./booking-status";
import { recordAction } from "./audit";
import { overlapAsConflict } from "./constraint-errors";
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
import { refreshRoomFeeds } from "./calendar-service";
import { quoteStay } from "./pricing";

const MAX_NIGHTS = 60;
const MAX_DAYS_AHEAD = 540;

const DATES_TAKEN = "Those dates were just taken. Please pick other dates.";

function assertBookableRange(range: DateRange, now: Date): void {
  const nights = countNights(range);
  if (nights < 1) throw invalid("Check-out must be after check-in");
  if (nights > MAX_NIGHTS) throw invalid(`Stays are limited to ${MAX_NIGHTS} nights`);
  const today = todayUtc(now);
  if (range.checkIn < today) throw invalid("Check-in cannot be in the past");
  if (range.checkIn > addDays(today, MAX_DAYS_AHEAD)) throw invalid("Those dates are too far ahead");
}

export interface BookingRequest {
  businessSlug: string;
  roomId: string;
  range: DateRange;
  guestCount: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  guestUserId: string | null;
  /** The language the guest is browsing in; their emails use it. */
  locale?: string;
}

/**
 * A guest asks for dates. The room is claimed now, not when the owner confirms, so when two guests race for
 * the last free night exactly one wins and the other hears it at once. The host's settings decide where the
 * booking starts: HELD (a request), AWAITING_PAYMENT (instant, paid online) or CONFIRMED (instant, paid at the place).
 */
export async function requestBooking(request: BookingRequest, now = new Date()): Promise<Booking> {
  const { businessSlug, ...stay } = request;
  assertBookableRange(stay.range, now);
  const business = await findActiveBusinessBySlug(prisma, businessSlug);
  if (!business) throw notFound("Place");

  let expiredIds: string[] = [];
  const booking = await overlapAsConflict(DATES_TAKEN, () =>
    runInTransaction(async (tx) => {
      // A place that can be booked whole or by room: bookings take turns across all its units.
      if (await hasWholePlaceUnit(tx, business.id)) await lockBusinessForBooking(tx, business.id);
      const room = await lockRoomForBooking(tx, business.id, request.roomId);
      assertRoomFits(room, request);
      expiredIds = await bookings.expireStaleHolds(tx, now, room.id);
      await assertNoImportedOverlap(tx, room.id, request.range);
      if (await bookings.findSiblingOverlap(tx, room, request.range)) throw conflict(DATES_TAKEN);

      const overrides = await findRateOverrides(tx, room.id, request.range);
      const quote = quoteStay({
        range: request.range,
        baseRateCents: room.baseRateCents,
        overrides,
        depositPercent: business.depositPercent,
      });

      const status = initialStatus(business);
      const created = await bookings.createBooking(tx, {
        ...stay,
        businessId: business.id,
        roomId: room.id,
        totalCents: quote.totalCents,
        depositCents: quote.depositCents,
        currency: business.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        status,
        holdExpiresAt: holdUntil(status, business.holdHours, now),
        onlineDueCents: onlineDue(business, quote),
        refundPolicy: business.refundPolicy,
      });
      // Same transaction: the guest never gets an error for a booking that was in fact created.
      await logActivity(tx, {
        userId: request.guestUserId,
        businessId: business.id,
        action: "booking.requested",
        entity: "booking",
        entityId: created.id,
      });
      return created;
    }),
  );
  if (booking.status === "HELD") {
    notifyBookingRequested(booking.id);
  } else {
    notifyBookingStatus(booking.id);
    notifyHostsNewBooking(booking.id);
  }
  expiredIds.forEach((id) => notifyBookingStatus(id));
  return booking;
}

async function lockRoomForBooking(tx: Tx, businessId: string, roomId: string) {
  const locked = await lockBookableRoom(tx, businessId, roomId);
  const room = locked ? await findRoom(tx, businessId, roomId) : null;
  if (!room) throw notFound("Room");
  return room;
}

function assertRoomFits(room: { capacity: number; minNights: number }, request: BookingRequest): void {
  if (request.guestCount > room.capacity) throw invalid(`This room sleeps up to ${room.capacity}`);
  if (countNights(request.range) < room.minNights) {
    throw invalid(`This room needs at least ${room.minNights} nights`);
  }
}

/** Imported nights are outside the DB constraint (platforms may overlap each other), so they are checked here under the room lock. */
async function assertNoImportedOverlap(tx: Tx, roomId: string, range: DateRange) {
  if (await bookings.findOverlappingImported(tx, roomId, range)) throw conflict(DATES_TAKEN);
}

export interface Decision {
  bookingId: string;
  reason?: string;
}

/**
 * The host accepts a request. Refreshes the room's platform calendars first, so a booking that just landed on
 * Airbnb is caught. When the host collects online, the booking then waits for the guest's payment.
 */
export async function confirmBooking(ctx: TenantContext, { bookingId }: Decision, now = new Date()) {
  requirePermission(ctx, "bookings.decide");
  const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
  if (!booking) throw notFound("Booking");
  await refreshRoomFeeds(ctx.businessId, booking.roomId);
  return decide(ctx, bookingId, statusOnAccept(booking.onlineDueCents), now);
}

export async function declineBooking(ctx: TenantContext, { bookingId, reason }: Decision, now = new Date()) {
  const booking = await decide(ctx, bookingId, "DECLINED", now, reason);
  await refundForEndedBooking(endedStay(booking), "host", now);
  return booking;
}

export async function cancelBooking(ctx: TenantContext, { bookingId, reason }: Decision, now = new Date()) {
  const booking = await decide(ctx, bookingId, "CANCELLED", now, reason);
  await refundForEndedBooking(endedStay(booking), "host", now);
  return booking;
}

const endedStay = (booking: Booking): EndedBooking => ({
  kind: "stay",
  id: booking.id,
  refundPolicy: booking.refundPolicy,
  startsAt: booking.checkIn,
  onlineDueCents: booking.onlineDueCents,
});

async function decide(
  ctx: TenantContext,
  bookingId: string,
  status: BookingStatus,
  now: Date,
  reason?: string,
) {
  requirePermission(ctx, "bookings.decide");
  const booking = await runInTransaction(async (tx) => {
    const current = await bookings.findBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    await lockActiveRoom(tx, ctx.businessId, current.roomId);
    assertTransition(current.status, status);
    if (status === "CONFIRMED" || status === "AWAITING_PAYMENT")
      await assertStillConfirmable(tx, current, now);
    return bookings.changeStatus(tx, ctx.businessId, bookingId, {
      status,
      decidedById: ctx.userId,
      decidedAt: now,
      cancelReason: reason,
      // Accepted with online payment: the guest gets the host's answer time again to pay.
      ...(status === "AWAITING_PAYMENT" && {
        holdExpiresAt: new Date(now.getTime() + PAY_AFTER_ACCEPT_HOURS * 3_600_000),
      }),
    });
  });
  await recordAction(ctx, `booking.${status.toLowerCase()}`, "booking", bookingId);
  notifyBookingStatus(bookingId);
  return booking;
}

async function assertStillConfirmable(tx: Tx, booking: Booking, now: Date) {
  if (booking.holdExpiresAt && booking.holdExpiresAt < now) {
    throw conflict("This hold has expired. Ask the guest to request again.");
  }
  await assertNoImportedOverlap(tx, booking.roomId, booking);
}

export async function getBooking(ctx: TenantContext, bookingId: string) {
  requirePermission(ctx, "bookings.read");
  const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
  if (!booking) throw notFound("Booking");
  return presentForStaff(ctx, booking);
}

export async function getBookingByReference(ctx: TenantContext, reference: string) {
  requirePermission(ctx, "bookings.read");
  const booking = await bookings.findBookingByReference(prisma, ctx.businessId, reference.toUpperCase());
  if (!booking) throw notFound("Booking");
  return presentForStaff(ctx, booking);
}

export async function listBookings(ctx: TenantContext, filters: bookings.BookingFilters) {
  requirePermission(ctx, "bookings.read");
  const rows = await bookings.listBookings(prisma, ctx.businessId, filters);
  return rows.map((booking) => presentForStaff(ctx, booking));
}

/** Hides guest contact details from team members without the guests.contact permission. */
export function presentForStaff<T extends Pick<Booking, "guestPhone" | "guestEmail">>(
  ctx: TenantContext,
  booking: T,
): T {
  if (can(ctx, "guests.contact")) return booking;
  return {
    ...booking,
    guestPhone: maskPhone(booking.guestPhone),
    guestEmail: booking.guestEmail && maskEmail(booking.guestEmail),
  };
}

/**
 * The guest cancels through their private link: while the request is held or confirmed, and before check-in.
 * The room is locked like any other change, the nights are freed, and both sides get an email.
 */
export async function cancelStayAsGuest(publicToken: string, reason: string | null, now = new Date()) {
  const booking = await runInTransaction(async (tx) => {
    const current = await bookings.findBookingByPublicToken(tx, publicToken);
    if (!current) return null;
    await lockActiveRoom(tx, current.businessId, current.roomId);
    assertTransition(current.status, "CANCELLED");
    if (current.checkIn <= todayUtc(now)) throw conflict("This stay has already started.");
    const updated = await bookings.changeStatus(tx, current.businessId, current.id, {
      status: "CANCELLED",
      cancelReason: reason ?? undefined,
    });
    await logActivity(tx, {
      userId: current.guestUserId,
      businessId: current.businessId,
      action: "booking.cancelled_by_guest",
      entity: "booking",
      entityId: current.id,
    });
    return updated;
  });
  if (booking) {
    notifyBookingStatus(booking.id);
    notifyGuestCancelled(booking.id);
    await refundForEndedBooking(endedStay(booking), "guest", now);
  }
  return booking;
}

export function getBookingForGuest(publicToken: string) {
  return bookings.findBookingByPublicToken(prisma, publicToken);
}

export function listMyBookings(userId: string) {
  return bookings.listGuestBookings(prisma, userId);
}

/** Cron: expires unanswered holds and tells each guest. Returns how many expired. */
export async function expireAllStaleHolds(now = new Date()) {
  const ids = await runInTransaction((tx) => bookings.expireStaleHolds(tx, now));
  ids.forEach((id) => notifyBookingStatus(id));
  return ids.length;
}
