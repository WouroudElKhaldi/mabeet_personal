import type { Booking, BookingStatus, Prisma } from "@prisma/client";
import { addDays, countNights, type DateRange, todayUtc } from "@/lib/dates";
import { maskEmail, maskPhone } from "@/lib/privacy";
import { bookingReference, secureToken } from "@/lib/tokens";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isOverlapError, prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as bookings from "@/server/repositories/booking-repository";
import { findActiveBusinessBySlug } from "@/server/repositories/business-repository";
import { findRateOverrides, findRoom, lockActiveRoom } from "@/server/repositories/room-repository";
import { assertTransition } from "./booking-status";
import { recordAction } from "./audit";
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
}

/**
 * A guest asks for dates. The room is claimed now (HELD), not when the owner confirms,
 * so when two guests race for the last free night exactly one wins and the other hears it at once.
 */
export async function requestBooking(request: BookingRequest, now = new Date()): Promise<Booking> {
  const { businessSlug, ...stay } = request;
  assertBookableRange(stay.range, now);
  const business = await findActiveBusinessBySlug(prisma, businessSlug);
  if (!business) throw notFound("Place");

  try {
    const booking = await runInTransaction(async (tx) => {
      const room = await lockRoomForBooking(tx, business.id, request.roomId);
      assertRoomFits(room, request);
      await bookings.expireStaleHolds(tx, now, room.id);
      await assertNoImportedOverlap(tx, room.id, request.range);

      const overrides = await findRateOverrides(tx, room.id, request.range);
      const quote = quoteStay({
        range: request.range,
        baseRateCents: room.baseRateCents,
        overrides,
        depositPercent: business.depositPercent,
      });

      return bookings.createHeldBooking(tx, {
        ...stay,
        businessId: business.id,
        roomId: room.id,
        totalCents: quote.totalCents,
        depositCents: quote.depositCents,
        currency: business.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        holdExpiresAt: new Date(now.getTime() + business.holdHours * 3_600_000),
      });
    });
    await logActivity(prisma, {
      userId: request.guestUserId,
      businessId: business.id,
      action: "booking.requested",
      entity: "booking",
      entityId: booking.id,
    });
    return booking;
  } catch (error) {
    if (isOverlapError(error)) throw conflict(DATES_TAKEN);
    throw error;
  }
}

async function lockRoomForBooking(tx: Prisma.TransactionClient, businessId: string, roomId: string) {
  const locked = await lockActiveRoom(tx, businessId, roomId);
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
async function assertNoImportedOverlap(tx: Prisma.TransactionClient, roomId: string, range: DateRange) {
  if (await bookings.findOverlappingImported(tx, roomId, range)) throw conflict(DATES_TAKEN);
}

export interface Decision {
  bookingId: string;
  reason?: string;
}

/** Refreshes the room's platform calendars first, so a booking that just landed on Airbnb is caught. */
export async function confirmBooking(ctx: TenantContext, { bookingId }: Decision, now = new Date()) {
  requirePermission(ctx, "bookings.decide");
  const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
  if (booking) await refreshRoomFeeds(ctx.businessId, booking.roomId);
  return decide(ctx, bookingId, "CONFIRMED", now);
}

export function declineBooking(ctx: TenantContext, { bookingId, reason }: Decision, now = new Date()) {
  return decide(ctx, bookingId, "DECLINED", now, reason);
}

export function cancelBooking(ctx: TenantContext, { bookingId, reason }: Decision, now = new Date()) {
  return decide(ctx, bookingId, "CANCELLED", now, reason);
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
    const current = await bookings.findBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    await lockActiveRoom(tx, ctx.businessId, current.roomId);
    assertTransition(current.status, status);
    if (status === "CONFIRMED") await assertStillConfirmable(tx, current, now);
    return bookings.changeStatus(tx, ctx.businessId, bookingId, {
      status,
      decidedById: ctx.userId,
      cancelReason: reason,
    });
  });
  await recordAction(ctx, `booking.${status.toLowerCase()}`, "booking", bookingId);
  return booking;
}

async function assertStillConfirmable(tx: Prisma.TransactionClient, booking: Booking, now: Date) {
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

export async function listBookings(ctx: TenantContext, filters: bookings.BookingFilters) {
  requirePermission(ctx, "bookings.read");
  const rows = await bookings.listBookings(prisma, ctx.businessId, filters);
  return rows.map((booking) => presentForStaff(ctx, booking));
}

/** Hides guest contact details from team members without the guests.contact permission. */
function presentForStaff<T extends Pick<Booking, "guestPhone" | "guestEmail">>(
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

export function getBookingForGuest(publicToken: string) {
  return bookings.findBookingByPublicToken(prisma, publicToken);
}

export function listMyBookings(userId: string) {
  return bookings.listGuestBookings(prisma, userId);
}

export function expireAllStaleHolds(now = new Date()) {
  return bookings.expireStaleHolds(prisma, now);
}
