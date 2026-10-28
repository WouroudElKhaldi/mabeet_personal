import type { FeedSource, Prisma } from "@prisma/client";
import type { DateRange } from "@/lib/dates";
import type { Db, Tx } from "@/server/db/client";
import type { FeedEvent } from "@/server/ical/parse-feed";
import { overlapsRange } from "./filters";

export function listOccupancy(db: Db, businessId: string, range: DateRange, roomId?: string) {
  return db.occupancy.findMany({
    where: { businessId, active: true, roomId, ...overlapsRange(range) },
    orderBy: { checkIn: "asc" },
    include: {
      booking: { select: { id: true, reference: true, status: true, guestName: true } },
      feed: { select: { source: true } },
    },
  });
}

export function createManualBlock(
  db: Db,
  block: {
    businessId: string;
    roomId: string;
    range: DateRange;
    source: FeedSource | null;
    note: string | null;
  },
) {
  return db.occupancy.create({
    data: {
      businessId: block.businessId,
      roomId: block.roomId,
      checkIn: block.range.checkIn,
      checkOut: block.range.checkOut,
      kind: "MANUAL",
      source: block.source,
      note: block.note,
    },
  });
}

export async function deactivateManualBlock(db: Db, businessId: string, blockId: string) {
  const { count } = await db.occupancy.updateMany({
    where: { id: blockId, businessId, kind: "MANUAL", active: true },
    data: { active: false },
  });
  return count > 0;
}

/** Moves a manual block to other dates or another room. The exclusion constraint refuses overlaps here. */
export async function moveManualBlock(
  db: Db,
  businessId: string,
  blockId: string,
  move: { roomId: string; range: DateRange },
) {
  const { count } = await db.occupancy.updateMany({
    where: { id: blockId, businessId, kind: "MANUAL", active: true },
    data: { roomId: move.roomId, checkIn: move.range.checkIn, checkOut: move.range.checkOut },
  });
  return count > 0;
}

/** Room export: our own direct bookings (held or confirmed) and manual blocks. Never re-exports imported nights. */
export function listExportableOccupancy(db: Db, roomId: string, from: Date) {
  return db.occupancy.findMany({
    where: { roomId, active: true, kind: { in: ["DIRECT", "MANUAL"] }, checkOut: { gt: from } },
    select: { id: true, checkIn: true, checkOut: true },
  });
}

export function findRoomByExportToken(db: Db, exportToken: string) {
  return db.room.findUnique({
    where: { exportToken },
    select: { id: true, name: true, business: { select: { name: true } } },
  });
}

// ---------- Feeds ----------

export function listFeeds(db: Db, businessId: string, roomId?: string) {
  return db.calendarFeed.findMany({ where: { businessId, roomId }, orderBy: { createdAt: "asc" } });
}

export function findFeed(db: Db, businessId: string, feedId: string) {
  return db.calendarFeed.findFirst({
    where: { id: feedId, businessId },
    include: { business: { select: { timezone: true } } },
  });
}

export function createFeed(db: Db, data: Prisma.CalendarFeedUncheckedCreateInput) {
  return db.calendarFeed.create({ data });
}

export async function deleteFeed(db: Db, businessId: string, feedId: string) {
  const { count } = await db.calendarFeed.deleteMany({ where: { id: feedId, businessId } });
  return count > 0;
}

export function listFeedsDueForSync(db: Db, staleBefore: Date, take: number) {
  return db.calendarFeed.findMany({
    where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }] },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
    select: { id: true, businessId: true },
    take,
  });
}

export function recordFeedResult(
  db: Db,
  feedId: string,
  result: { lastSyncedAt: Date; lastError: string | null },
) {
  return db.calendarFeed.update({ where: { id: feedId }, data: result });
}

/**
 * Treats the feed as a full snapshot: upserts each event and deactivates the ones that disappeared
 * (the guest cancelled on the platform). Caller must hold the room lock.
 */
export async function replaceImportedEvents(
  tx: Tx,
  feed: { id: string; businessId: string; roomId: string; source: FeedSource },
  events: readonly FeedEvent[],
) {
  for (const event of events) {
    await tx.occupancy.upsert({
      where: { feedId_externalUid: { feedId: feed.id, externalUid: event.uid } },
      create: {
        businessId: feed.businessId,
        roomId: feed.roomId,
        feedId: feed.id,
        externalUid: event.uid,
        source: feed.source,
        kind: "IMPORTED",
        checkIn: event.checkIn,
        checkOut: event.checkOut,
      },
      update: { checkIn: event.checkIn, checkOut: event.checkOut, active: true },
    });
  }
  await tx.occupancy.updateMany({
    where: { feedId: feed.id, active: true, externalUid: { notIn: events.map((event) => event.uid) } },
    data: { active: false },
  });
}

/** Flags imported nights that collide with our own active bookings or blocks, so the owner sees them. */
export async function flagImportConflicts(tx: Tx, feedId: string, roomId: string) {
  await tx.$executeRaw`
    UPDATE "Occupancy" AS imported
    SET conflict = EXISTS (
      SELECT 1 FROM "Occupancy" AS own
      WHERE own."roomId" = ${roomId}
        AND own.active AND own.kind <> 'IMPORTED'
        AND daterange(own."checkIn", own."checkOut", '[)') && daterange(imported."checkIn", imported."checkOut", '[)')
    )
    WHERE imported."feedId" = ${feedId}`;
  return tx.occupancy.count({ where: { feedId, active: true, conflict: true } });
}
