import { json, parseParams, requireTenant, route } from "@/server/http/route";
import { syncFeedNow } from "@/server/services/calendar-service";
import { feedParams } from "@/server/validation/schemas";

export const POST = route(async (request, context) => {
  const { businessId, feedId } = await parseParams(context, feedParams);
  const ctx = await requireTenant(request, businessId);
  return json(await syncFeedNow(ctx, feedId));
});
