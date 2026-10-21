import { createHash, randomBytes } from "node:crypto";
import { addDays } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as keys from "@/server/repositories/api-key-repository";
import { recordAction } from "./audit";
import { resolveKeyContext } from "./team-service";

const KEY_PREFIX = "mbt_";
const VISIBLE_PREFIX_LENGTH = 12;

const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

export interface NewKey {
  name: string;
  canWrite: boolean;
  expiresInDays: number | null;
}

/**
 * Issues a key bound to the calling member. Whatever AI uses it sees exactly what that member may see.
 * The plain key is returned once; only its hash is stored.
 */
export async function createKey(ctx: TenantContext, input: NewKey, now = new Date()) {
  requirePermission(ctx, "ai.use");
  const raw = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const key = await keys.createApiKey(prisma, {
    businessId: ctx.businessId,
    membershipId: ctx.membershipId,
    createdById: ctx.userId,
    name: input.name,
    prefix: raw.slice(0, VISIBLE_PREFIX_LENGTH),
    hash: hashKey(raw),
    canWrite: input.canWrite,
    expiresAt: input.expiresInDays ? addDays(now, input.expiresInDays) : null,
  });
  await recordAction(ctx, "api_key.created", "api_key", key.id);
  return { ...key, secret: raw };
}

export function listKeys(ctx: TenantContext) {
  requirePermission(ctx, "ai.use");
  return keys.listMemberKeys(prisma, ctx.businessId, ctx.membershipId);
}

export async function revokeKey(ctx: TenantContext, keyId: string) {
  requirePermission(ctx, "ai.use");
  if (!(await keys.revokeMemberKey(prisma, ctx.businessId, ctx.membershipId, keyId))) throw notFound("Key");
  await recordAction(ctx, "api_key.revoked", "api_key", keyId);
}

/** Turns a presented key into the member's context, or null. Removed members' keys stop working at once. */
export async function authenticateKey(raw: string, now = new Date()) {
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const key = await keys.findLiveKeyByHash(prisma, hashKey(raw), now);
  if (!key) return null;
  const ctx = await resolveKeyContext(key.businessId, key.membershipId, key.canWrite);
  if (!ctx) return null;
  await keys.touchKey(prisma, key.id, now);
  return { ctx, keyId: key.id };
}

export function recordToolCall(entry: Parameters<typeof keys.logToolCall>[1]) {
  return keys.logToolCall(prisma, entry);
}

export function listToolCalls(ctx: TenantContext, take = 50) {
  requirePermission(ctx, "ai.use");
  return keys.listToolCalls(prisma, ctx.businessId, take);
}
