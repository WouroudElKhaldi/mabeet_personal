import type { z } from "zod";
import { addDays, type DateRange, eachNight, toIsoDate, todayUtc } from "@/lib/dates";
import { secureToken } from "@/lib/tokens";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as rooms from "@/server/repositories/room-repository";
import type { roomInput, roomUpdate } from "@/server/validation/schemas";
import { recordAction } from "./audit";
import { assertPlanAllowsAnother } from "./billing-service";

export function listRooms(ctx: TenantContext) {
  requirePermission(ctx, "rooms.read");
  return rooms.listRooms(prisma, ctx.businessId);
}

export async function getRoom(ctx: TenantContext, roomId: string) {
  requirePermission(ctx, "rooms.read");
  const room = await rooms.findRoom(prisma, ctx.businessId, roomId);
  if (!room) throw notFound("Room");
  return room;
}

export async function createRoom(ctx: TenantContext, input: z.infer<typeof roomInput>) {
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
