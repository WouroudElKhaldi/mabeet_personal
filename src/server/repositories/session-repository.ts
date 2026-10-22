import type { Db } from "@/server/db/client";

/** The workspace picked while connecting an AI app (see mcp-oauth-service). */
export async function setSessionWorkspace(db: Db, sessionId: string, businessId: string) {
  await db.session.update({ where: { id: sessionId }, data: { mcpBusinessId: businessId } });
}

export async function findClientName(db: Db, clientId: string): Promise<string | null> {
  return (await db.oauthClient.findUnique({ where: { clientId }, select: { name: true } }))?.name ?? null;
}

export async function findBusinessName(db: Db, businessId: string): Promise<string | null> {
  return (await db.business.findUnique({ where: { id: businessId }, select: { name: true } }))?.name ?? null;
}
