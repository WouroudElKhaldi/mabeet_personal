import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/server/auth/better-auth";
import { unauthenticated } from "@/server/errors";
import { json, parseBody, route } from "@/server/http/route";
import { chooseWorkspace } from "@/server/services/mcp-oauth-service";

/** Saves the workspace picked on /oauth/workspace on the current sign-in session. */
export const POST = route(async (request) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw unauthenticated();
  const { businessId } = await parseBody(request, z.object({ businessId: z.string().min(1).max(64) }));
  await chooseWorkspace({ id: session.session.id, userId: session.user.id }, businessId);
  return json({ ok: true });
});
