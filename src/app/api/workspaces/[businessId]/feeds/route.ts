import { json, parseBody, tenantRoute } from "@/server/http/route";
import { addFeed, getChannelSetup } from "@/server/services/calendar-service";
import { feedInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await getChannelSetup(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await addFeed(ctx, await parseBody(request, feedInput)), 201);
});
