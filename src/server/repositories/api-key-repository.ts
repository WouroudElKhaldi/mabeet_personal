import type { Db } from "@/server/db/client";

export function createApiKey(
  db: Db,
  key: {
    businessId: string;
    membershipId: string;
    createdById: string;
    name: string;
    prefix: string;
    hash: string;
    canWrite: boolean;
    expiresAt: Date | null;
  },
) {
  return db.apiKey.create({ data: key, select: { id: true, prefix: true, name: true } });
}

export function listMemberKeys(db: Db, businessId: string, membershipId: string) {
  return db.apiKey.findMany({
    where: { businessId, membershipId, revokedAt: null },
    select: {
      id: true,
      name: true,
      prefix: true,
      canWrite: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeMemberKey(db: Db, businessId: string, membershipId: string, keyId: string) {
  const { count } = await db.apiKey.updateMany({
    where: { id: keyId, businessId, membershipId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

export function findLiveKeyByHash(db: Db, hash: string, now: Date) {
  return db.apiKey.findFirst({
    where: { hash, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { id: true, businessId: true, membershipId: true, canWrite: true },
  });
}

export function touchKey(db: Db, keyId: string, now: Date) {
  return db.apiKey.update({ where: { id: keyId }, data: { lastUsedAt: now } });
}

export function logToolCall(
  db: Db,
  entry: {
    businessId: string;
    apiKeyId?: string;
    userId?: string;
    channel: "mcp" | "chat";
    tool: string;
    outcome: string;
    latencyMs: number;
  },
) {
  return db.mcpAuditLog.create({ data: entry });
}

export function listToolCalls(db: Db, businessId: string, take: number) {
  return db.mcpAuditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take });
}
