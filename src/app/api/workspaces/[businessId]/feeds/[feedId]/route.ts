import { json, tenantRoute } from "@/server/http/route";
import { removeFeed } from "@/server/services/calendar-service";
import { feedParams } from "@/server/validation/schemas";

export const DELETE = tenantRoute(feedParams, async ({ ctx, params: { feedId } }) => {
  await removeFeed(ctx, feedId);
  return json({ ok: true });
});
