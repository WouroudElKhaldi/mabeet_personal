import type { z } from "zod";
import { secureToken } from "@/lib/tokens";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as rooms from "@/server/repositories/room-repository";
import type { roomInput, roomUpdate } from "@/server/validation/schemas";
import { recordAction } from "./audit";

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
