import type { Prisma, RoomKind } from "@prisma/client";
import { type DateRange, toIsoDate } from "@/lib/dates";
import type { Db, Tx } from "@/server/db/client";

export function findRoom(db: Db, businessId: string, roomId: string) {
  return db.room.findFirst({ where: { id: roomId, businessId } });
}

export function listRooms(db: Db, businessId: string) {
  return db.room.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
}

export function createRoom(db: Db, data: Prisma.RoomUncheckedCreateInput) {
  return db.room.create({ data });
}

export async function updateRoom(
  db: Db,
  businessId: string,
  roomId: string,
  data: Prisma.RoomUpdateManyMutationInput,
) {
  const { count } = await db.room.updateMany({ where: { id: roomId, businessId }, data });
  return count > 0;
}

/**
 * A room guests can book: live, and of the kind the place books by (its rooms, or the whole place as one).
 * The same rule in SQL is in lockBookableRoom.
 */
export const bookableRoom = {
  active: true,
  OR: [
    { kind: "ROOM", business: { bookingUnit: "ROOMS" } },
    { kind: "WHOLE_PLACE", business: { bookingUnit: "WHOLE_PLACE" } },
  ],
} satisfies Prisma.RoomWhereInput;

/**
 * Takes a row lock on an active room for the rest of the transaction. Every booking request
 * and iCal import for that room waits here, so checks against imported nights are race-free.
 */
export async function lockActiveRoom(tx: Tx, businessId: string, roomId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Room"
    WHERE id = ${roomId} AND "businessId" = ${businessId} AND active
    FOR UPDATE`;
  return rows.length > 0;
}

/** Like lockActiveRoom, but only for a room guests can book right now (see bookableRoom). */
export async function lockBookableRoom(tx: Tx, businessId: string, roomId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM "Room" r
    JOIN "Business" b ON b.id = r."businessId"
    WHERE r.id = ${roomId} AND r."businessId" = ${businessId} AND r.active
      AND ((b."bookingUnit" = 'ROOMS' AND r.kind = 'ROOM')
        OR (b."bookingUnit" = 'WHOLE_PLACE' AND r.kind = 'WHOLE_PLACE'))
    FOR UPDATE OF r`;
  return rows.length > 0;
}

/** Whether a business has a whole-place unit, so its bookings must also be checked across every room. */
export async function hasWholePlaceUnit(db: Db, businessId: string) {
  return (await db.room.count({ where: { businessId, kind: "WHOLE_PLACE" } })) > 0;
}

/** Locks the business row: bookings at a place with a whole-place unit take turns, across all its rooms. */
export async function lockBusinessForBooking(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
}

export function findWholePlaceUnit(db: Db, businessId: string) {
  return db.room.findFirst({ where: { businessId, kind: "WHOLE_PLACE" } });
}

/** Sums of the place's rooms, to start a whole-place unit from. */
export function sumRooms(db: Db, businessId: string) {
  return db.room.aggregate({
    where: { businessId, kind: "ROOM" as RoomKind },
    _sum: { capacity: true, bedrooms: true, beds: true, bathrooms: true, baseRateCents: true },
  });
}

export async function findRateOverrides(db: Db, roomId: string, range: DateRange) {
  const overrides = await db.rateOverride.findMany({
    where: { roomId, date: { gte: range.checkIn, lt: range.checkOut } },
    select: { date: true, rateCents: true },
  });
  return new Map(overrides.map((override) => [toIsoDate(override.date), override.rateCents]));
}

export function listRoomNames(db: Db, businessId: string) {
  return db.room.findMany({
    where: { businessId, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

export function listRoomExports(db: Db, businessId: string) {
  return db.room.findMany({
    where: { businessId },
    select: { id: true, name: true, exportToken: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Special prices from `from` on, one row per night, in date order. */
export function listRateOverrides(db: Db, businessId: string, roomId: string, from: Date) {
  return db.rateOverride.findMany({
    where: { businessId, roomId, date: { gte: from } },
    orderBy: { date: "asc" },
    select: { date: true, rateCents: true },
  });
}

/** Sets every night in `nights` to `rateCents`, or back to the base rate when it is null. Run in a transaction. */
export async function setRateOverrides(
  tx: Tx,
  businessId: string,
  roomId: string,
  nights: Date[],
  rateCents: number | null,
) {
  await tx.rateOverride.deleteMany({ where: { roomId, date: { in: nights } } });
  if (rateCents !== null) {
    await tx.rateOverride.createMany({
      data: nights.map((date) => ({ businessId, roomId, date, rateCents })),
    });
  }
}
