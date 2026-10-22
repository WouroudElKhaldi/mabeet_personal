import type { Prisma } from "@prisma/client";
import { type DateRange, toIsoDate } from "@/lib/dates";
import type { Db } from "@/server/db/client";

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
 * Takes a row lock on an active room for the rest of the transaction. Every booking request
 * and iCal import for that room waits here, so checks against imported nights are race-free.
 */
export async function lockActiveRoom(tx: Prisma.TransactionClient, businessId: string, roomId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Room"
    WHERE id = ${roomId} AND "businessId" = ${businessId} AND active
    FOR UPDATE`;
  return rows.length > 0;
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
  tx: Prisma.TransactionClient,
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
