import type { BookingStatus, RefundPolicy } from "@prisma/client";
import { EXPIRING_BOOKING_STATUSES, isActiveBooking } from "@/config/enums";
import type { DateRange } from "@/lib/dates";
import type { Db, Tx } from "@/server/db/client";
import { overlapsRange } from "./filters";

export interface NewBooking {
  businessId: string;
  roomId: string;
  guestUserId: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestCount: number;
  guestNote: string | null;
  range: DateRange;
  totalCents: number;
  depositCents: number;
  currency: string;
  reference: string;
  publicToken: string;
  /** HELD for a request, AWAITING_PAYMENT or CONFIRMED for an instant booking. All of them take the nights. */
  status: BookingStatus;
  holdExpiresAt: Date | null;
  onlineDueCents: number | null;
  refundPolicy: RefundPolicy;
  /** The guest's language, for their emails. Defaults to English. */
  locale?: string;
}

/** Inserts the booking and its DIRECT occupancy row. The exclusion constraint rejects overlaps here. */
export function createBooking(tx: Tx, booking: NewBooking) {
  const { range, ...fields } = booking;
  return tx.booking.create({
    data: {
      ...fields,
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      occupancy: {
        create: {
          businessId: booking.businessId,
          roomId: booking.roomId,
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          kind: "DIRECT",
        },
      },
    },
  });
}

/** Expires holds the owner never answered, or bookings never paid, and frees their nights. Returns their ids. */
export async function expireStaleHolds(db: Db, now: Date, roomId?: string): Promise<string[]> {
  // One UPDATE that re-checks status: a hold confirmed (or paid) a moment earlier is never touched.
  const expired = await db.booking.updateManyAndReturn({
    where: {
      status: { in: [...EXPIRING_BOOKING_STATUSES] },
      holdExpiresAt: { lt: now },
      ...(roomId && { roomId }),
    },
    data: { status: "EXPIRED" },
    select: { id: true },
  });
  const ids = expired.map((booking) => booking.id);
  if (ids.length === 0) return ids;
  await db.occupancy.updateMany({ where: { bookingId: { in: ids } }, data: { active: false } });
  return ids;
}

export function findOverlappingImported(db: Db, roomId: string, range: DateRange) {
  return db.occupancy.findFirst({
    where: {
      roomId,
      kind: "IMPORTED",
      active: true,
      ...overlapsRange(range),
    },
  });
}

/**
 * Nights taken on the place's other units that clash with a stay: any room when booking the whole place, the
 * whole-place unit when booking a room. Only places that have a whole-place unit need this.
 */
export function findSiblingOverlap(
  db: Db,
  room: { id: string; businessId: string; kind: "ROOM" | "WHOLE_PLACE" },
  range: DateRange,
) {
  return db.occupancy.findFirst({
    where: {
      businessId: room.businessId,
      roomId: { not: room.id },
      active: true,
      ...(room.kind === "ROOM" && { room: { kind: "WHOLE_PLACE" } }),
      ...overlapsRange(range),
    },
  });
}

export function findBooking(db: Db, businessId: string, bookingId: string) {
  return db.booking.findFirst({ where: { id: bookingId, businessId }, include: { room: true } });
}

export function findBookingByReference(db: Db, businessId: string, reference: string) {
  return db.booking.findFirst({ where: { reference, businessId }, include: { room: true } });
}

/** Which of these businesses holds the booking with this reference, if any (references are unique site-wide). */
export function findBookingBusiness(db: Db, reference: string, businessIds: string[]) {
  return db.booking.findFirst({
    where: { reference, businessId: { in: businessIds } },
    select: { businessId: true },
  });
}

export function findBookingByPublicToken(db: Db, publicToken: string) {
  return db.booking.findUnique({
    where: { publicToken },
    include: { room: true, business: true, payments: true },
  });
}

export interface BookingFilters {
  status?: BookingStatus;
  roomId?: string;
  from?: Date;
  to?: Date;
  take: number;
  skip: number;
}

export function listBookings(db: Db, businessId: string, filters: BookingFilters) {
  return db.booking.findMany({
    where: {
      businessId,
      status: filters.status,
      roomId: filters.roomId,
      checkOut: filters.from && { gt: filters.from },
      checkIn: filters.to && { lt: filters.to },
    },
    orderBy: { checkIn: "asc" },
    take: filters.take,
    skip: filters.skip,
    include: { room: { select: { id: true, name: true } } },
  });
}

export function listGuestBookings(db: Db, guestUserId: string) {
  return db.booking.findMany({
    where: { guestUserId },
    orderBy: { checkIn: "desc" },
    include: {
      room: { select: { name: true } },
      business: { select: { name: true, slug: true } },
      review: { select: { id: true } },
    },
  });
}

export interface StatusChange {
  status: BookingStatus;
  /** The team member who decided, and when; absent when the guest or the clock changed the status. */
  decidedById?: string;
  decidedAt?: Date;
  cancelReason?: string;
  /** A new deadline, e.g. the time the guest has to pay once the host accepts. */
  holdExpiresAt?: Date | null;
}

/** Moves a booking to a new status and keeps its occupancy row's `active` flag in step. */
export async function changeStatus(tx: Tx, businessId: string, bookingId: string, change: StatusChange) {
  const booking = await tx.booking.update({ where: { id: bookingId, businessId }, data: change });
  await tx.occupancy.updateMany({
    where: { bookingId, businessId },
    data: { active: isActiveBooking(change.status) },
  });
  return booking;
}
