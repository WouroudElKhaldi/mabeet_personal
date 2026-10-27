import type { z } from "zod";
import { addDays, type DateRange, eachNight, toIsoDate, todayUtc } from "@/lib/dates";
import { secureToken } from "@/lib/tokens";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import * as rooms from "@/server/repositories/room-repository";
import type { roomInput, roomUpdate } from "@/server/validation/schemas";
import { recordAction } from "./audit";
import { assertPlanAllowsAnother } from "./billing-service";

export function listRooms(ctx: TenantContext) {
  requirePermission(ctx, "rooms.read");
  return rooms.listRooms(prisma, ctx.businessId);
}

/**
 * A room named the way a person or an AI says it: its id, its exact name, or a part of its name that fits only
 * one room. A name that fits several rooms is refused rather than guessed. Callers check their own permission
 * (closing dates needs blocks.manage, not rooms.read).
 */
export async function findRoomByNameOrId(ctx: TenantContext, nameOrId: string) {
  const all = await rooms.listRooms(prisma, ctx.businessId);
  const wanted = nameOrId.trim().toLowerCase();
  const exact = all.filter((room) => room.id === nameOrId.trim() || room.name.toLowerCase() === wanted);
  const matches = exact.length > 0 ? exact : all.filter((room) => room.name.toLowerCase().includes(wanted));
  if (matches.length === 0) throw notFound("Room");
  if (matches.length > 1) {
    throw invalid(`Several rooms match "${nameOrId}": ${matches.map((room) => room.name).join(", ")}`);
  }
  return matches[0]!;
}

export async function getRoom(ctx: TenantContext, roomId: string) {
  requirePermission(ctx, "rooms.read");
  const room = await rooms.findRoom(prisma, ctx.businessId, roomId);
  if (!room) throw notFound("Room");
  return room;
}

export async function createRoom(ctx: TenantContext, input: z.input<typeof roomInput>) {
  requirePermission(ctx, "rooms.manage");
  await assertPlanAllowsAnother(ctx.businessId, "rooms");
  const room = await rooms.createRoom(prisma, {
    ...input,
    businessId: ctx.businessId,
    exportToken: secureToken(),
  });
  await recordAction(ctx, "room.created", "room", room.id);
  return room;
}

/**
 * Makes sure a place booked as a whole has its one whole-place unit: started from its rooms (guests, beds,
 * bathrooms and nightly prices added up), then the host adjusts it like any room. Doesn't count against the plan.
 */
export async function ensureWholePlaceUnit(ctx: TenantContext, name: string) {
  requirePermission(ctx, "rooms.manage");
  const existing = await rooms.findWholePlaceUnit(prisma, ctx.businessId);
  if (existing) return existing;
  const { _sum: sum } = await rooms.sumRooms(prisma, ctx.businessId);
  const unit = await rooms.createRoom(prisma, {
    businessId: ctx.businessId,
    kind: "WHOLE_PLACE",
    name,
    capacity: Math.max(1, sum.capacity ?? 2),
    bedrooms: sum.bedrooms ?? 1,
    beds: sum.beds ?? 1,
    bathrooms: sum.bathrooms ?? 1,
    baseRateCents: sum.baseRateCents ?? 10_000,
    minNights: 1,
    amenities: [],
    exportToken: secureToken(),
  });
  await recordAction(ctx, "room.created", "room", unit.id);
  return unit;
}

export async function updateRoom(ctx: TenantContext, roomId: string, input: z.infer<typeof roomUpdate>) {
  requirePermission(ctx, "rooms.manage");
  if (!(await rooms.updateRoom(prisma, ctx.businessId, roomId, input))) throw notFound("Room");
  await recordAction(ctx, "room.updated", "room", roomId);
}

/** Upcoming special prices for a room, joined into runs of consecutive nights at the same price. */
export async function listSpecialPrices(ctx: TenantContext, roomId: string, today = todayUtc()) {
  requirePermission(ctx, "rooms.read");
  const nights = await rooms.listRateOverrides(prisma, ctx.businessId, roomId, today);
  const runs: Array<{ from: string; to: string; rateCents: number }> = [];
  for (const night of nights) {
    const last = runs.at(-1);
    if (last && last.to === toIsoDate(night.date) && last.rateCents === night.rateCents) {
      last.to = toIsoDate(addDays(night.date, 1));
    } else {
      runs.push({
        from: toIsoDate(night.date),
        to: toIsoDate(addDays(night.date, 1)),
        rateCents: night.rateCents,
      });
    }
  }
  return runs;
}

/** Sets a price for every night from `checkIn` up to (not including) `checkOut`; null goes back to the base rate. */
export async function setSpecialPrice(
  ctx: TenantContext,
  roomId: string,
  range: DateRange,
  rateCents: number | null,
) {
  requirePermission(ctx, "rooms.manage");
  if (!(await rooms.findRoom(prisma, ctx.businessId, roomId))) throw notFound("Room");
  await runInTransaction((tx) =>
    rooms.setRateOverrides(tx, ctx.businessId, roomId, eachNight(range), rateCents),
  );
  await recordAction(ctx, rateCents === null ? "room.price_cleared" : "room.price_set", "room", roomId);
}
