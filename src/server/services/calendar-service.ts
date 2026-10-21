import type { FeedSource } from "@prisma/client";
import { addDays, type DateRange, todayUtc } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isOverlapError, prisma, runInTransaction } from "@/server/db/client";
import { conflict, notFound } from "@/server/errors";
import { buildExportFeed } from "@/server/ical/build-feed";
import { parseFeed } from "@/server/ical/parse-feed";
import { assertPublicHttpsUrl, fetchCalendarText } from "@/server/ical/safe-fetch";
import * as calendar from "@/server/repositories/calendar-repository";
import { findRoom, lockActiveRoom } from "@/server/repositories/room-repository";
import { recordAction } from "./audit";

const IMPORT_HORIZON_DAYS = 540;
const SYNC_INTERVAL_MS = 15 * 60_000;
const SYNC_BATCH_SIZE = 20;

async function requireRoom(ctx: TenantContext, roomId: string) {
  const room = await findRoom(prisma, ctx.businessId, roomId);
  if (!room) throw notFound("Room");
  return room;
}

export function getCalendar(ctx: TenantContext, range: DateRange, roomId?: string) {
  requirePermission(ctx, "calendar.read");
  return calendar.listOccupancy(prisma, ctx.businessId, range, roomId);
}

// ---------- Manual blocks (also how Kazderni or walk-in bookings are recorded) ----------

export interface BlockInput {
  roomId: string;
  range: DateRange;
  source: FeedSource | null;
  note: string | null;
}

export async function addBlock(ctx: TenantContext, input: BlockInput) {
  requirePermission(ctx, "blocks.manage");
  await requireRoom(ctx, input.roomId);
  try {
    const block = await calendar.createManualBlock(prisma, { ...input, businessId: ctx.businessId });
    await recordAction(ctx, "block.added", "occupancy", block.id);
    return block;
  } catch (error) {
    if (isOverlapError(error)) throw conflict("Those nights are already booked or blocked");
    throw error;
  }
}

export async function removeBlock(ctx: TenantContext, blockId: string) {
  requirePermission(ctx, "blocks.manage");
  if (!(await calendar.deactivateManualBlock(prisma, ctx.businessId, blockId))) throw notFound("Block");
  await recordAction(ctx, "block.removed", "occupancy", blockId);
}

// ---------- Feeds from Airbnb, Booking.com, Kazderni ----------

export function listFeeds(ctx: TenantContext, roomId?: string) {
  requirePermission(ctx, "feeds.manage");
  return calendar.listFeeds(prisma, ctx.businessId, roomId);
}

export async function addFeed(
  ctx: TenantContext,
  input: { roomId: string; url: string; source: FeedSource },
) {
  requirePermission(ctx, "feeds.manage");
  await requireRoom(ctx, input.roomId);
  await assertPublicHttpsUrl(input.url);
  const feed = await calendar.createFeed(prisma, { ...input, businessId: ctx.businessId });
  await recordAction(ctx, "feed.added", "feed", feed.id);
  await syncFeed(ctx.businessId, feed.id);
  return feed;
}

export async function removeFeed(ctx: TenantContext, feedId: string) {
  requirePermission(ctx, "feeds.manage");
  if (!(await calendar.deleteFeed(prisma, ctx.businessId, feedId))) throw notFound("Calendar link");
  await recordAction(ctx, "feed.removed", "feed", feedId);
}

export async function syncFeedNow(ctx: TenantContext, feedId: string) {
  requirePermission(ctx, "feeds.manage");
  return syncFeed(ctx.businessId, feedId);
}

export interface SyncResult {
  ok: boolean;
  conflicts: number;
  error?: string;
}

/** Pulls one feed and mirrors it into IMPORTED occupancy under the room lock. Never cancels anything. */
export async function syncFeed(businessId: string, feedId: string, now = new Date()): Promise<SyncResult> {
  const feed = await calendar.findFeed(prisma, businessId, feedId);
  if (!feed) throw notFound("Calendar link");
  try {
    const today = todayUtc(now);
    const events = parseFeed(await fetchCalendarText(feed.url), {
      from: today,
      to: addDays(today, IMPORT_HORIZON_DAYS),
      timezone: feed.business.timezone,
    });
    const conflicts = await runInTransaction(async (tx) => {
      await lockActiveRoom(tx, businessId, feed.roomId);
      await calendar.replaceImportedEvents(tx, feed, events);
      return calendar.flagImportConflicts(tx, feed.id, feed.roomId);
    });
    await calendar.recordFeedResult(prisma, feed.id, { lastSyncedAt: now, lastError: null });
    return { ok: true, conflicts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await calendar.recordFeedResult(prisma, feed.id, { lastSyncedAt: now, lastError: message });
    return { ok: false, conflicts: 0, error: message };
  }
}

/** Refreshes every feed of a room, e.g. right before an owner confirms, so a fresh platform booking is caught. */
export async function refreshRoomFeeds(businessId: string, roomId: string): Promise<void> {
  const feeds = await calendar.listFeeds(prisma, businessId, roomId);
  await Promise.all(feeds.map((feed) => syncFeed(businessId, feed.id)));
}

/** Cron entry point: syncs feeds older than the interval, a small batch at a time. */
export async function syncDueFeeds(now = new Date()) {
  const due = await calendar.listFeedsDueForSync(
    prisma,
    new Date(now.getTime() - SYNC_INTERVAL_MS),
    SYNC_BATCH_SIZE,
  );
  const results = await Promise.all(due.map((feed) => syncFeed(feed.businessId, feed.id, now)));
  return {
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  };
}

/** The .ics our rooms publish for the platforms to import. Null when the token is unknown. */
export async function buildRoomExport(exportToken: string, now = new Date()): Promise<string | null> {
  const room = await calendar.findRoomByExportToken(prisma, exportToken);
  if (!room) return null;
  const events = await calendar.listExportableOccupancy(prisma, room.id, todayUtc(now));
  return buildExportFeed(`${room.business.name} · ${room.name}`, events);
}
