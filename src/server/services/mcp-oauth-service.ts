import { can } from "@/server/auth/tenant-context";
import { PLAN_LIMITS } from "@/config/plans";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { forbidden } from "@/server/errors";
import * as billing from "@/server/repositories/billing-repository";
import {
  findBusinessName,
  findClientName,
  setSessionWorkspace,
} from "@/server/repositories/session-repository";
import { listWorkspaces, resolveContext, resolveTokenContext } from "./team-service";

// Connecting an AI app with OAuth instead of an API key. The person signs in, picks one workspace, and
// allows read or read-and-change access. The token then acts as that member, in that workspace only.

/** The host MCP server, as the OAuth "resource" its tokens are issued for. */
export const MCP_RESOURCE = new URL("/api/mcp", env.BETTER_AUTH_URL).toString();
export const MCP_SCOPES = { read: "mcp:read", write: "mcp:write" } as const;

async function aiAllowed(userId: string, businessId: string): Promise<boolean> {
  const ctx = await resolveContext(userId, businessId, "mcp");
  if (!ctx || !can(ctx, "ai.use")) return false;
  const plan = (await billing.findBilling(prisma, businessId))?.plan;
  return plan !== undefined && PLAN_LIMITS[plan].ai;
}

/** Workspaces this person may connect an AI app to: they hold ai.use there, on a plan with AI. */
export async function listConnectableWorkspaces(userId: string) {
  const workspaces = await listWorkspaces(userId);
  const allowed = await Promise.all(workspaces.map((w) => aiAllowed(userId, w.businessId)));
  return workspaces.filter((_, index) => allowed[index]).map((w) => ({ ...w.business, role: w.role.name }));
}

/** Saves the picked workspace on the sign-in session, for the rest of this authorization. */
export async function chooseWorkspace(session: { id: string; userId: string }, businessId: string) {
  if (!(await aiAllowed(session.userId, businessId)))
    throw forbidden("You cannot connect an AI app to this workspace");
  await setSessionWorkspace(prisma, session.id, businessId);
}

/** The session's picked workspace, if the person may still connect to it; otherwise null. */
export async function pickedWorkspace(userId: string, businessId: unknown): Promise<string | null> {
  if (typeof businessId !== "string" || !businessId) return null;
  return (await aiAllowed(userId, businessId)) ? businessId : null;
}

/** The member a verified access token acts as. Null when the membership or the plan no longer allows it. */
export async function contextForToken(userId: string, businessId: string, scopes: readonly string[]) {
  if (!(await aiAllowed(userId, businessId))) return null;
  return resolveTokenContext(userId, businessId, scopes.includes(MCP_SCOPES.write));
}

/** Names for the consent screen: the app asking, and the workspace it would act in. */
export async function describeConsent(userId: string, businessId: unknown, clientId: string) {
  const [client, workspace] = await Promise.all([
    findClientName(prisma, clientId),
    pickedWorkspace(userId, businessId).then((id) => (id ? findBusinessName(prisma, id) : null)),
  ]);
  return { appName: client, businessName: workspace };
}
