import { json, tenantRoute } from "@/server/http/route";
import { syncFeedNow } from "@/server/services/calendar-service";
import { feedParams } from "@/server/validation/schemas";

export const POST = tenantRoute(feedParams, async ({ ctx, params: { feedId } }) => {
  return json(await syncFeedNow(ctx, feedId));
});
