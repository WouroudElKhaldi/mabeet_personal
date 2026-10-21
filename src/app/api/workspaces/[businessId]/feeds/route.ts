import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { addFeed, listFeeds } from "@/server/services/calendar-service";
import { feedInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listFeeds(ctx));
});

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await addFeed(ctx, await parseBody(request, feedInput)), 201);
});
