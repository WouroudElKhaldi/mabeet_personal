import { json, parseBody, tenantRoute } from "@/server/http/route";
import { addSessions } from "@/server/services/offering-service";
import { offeringParams, sessionsInput } from "@/server/validation/schemas";

export const POST = tenantRoute(offeringParams, async ({ request, ctx, params: { offeringId } }) => {
  return json(await addSessions(ctx, offeringId, await parseBody(request, sessionsInput)), 201);
});
