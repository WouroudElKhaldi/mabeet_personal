import { json, parseParams, requireTenant, route } from "@/server/http/route";
import { removeFeed } from "@/server/services/calendar-service";
import { feedParams } from "@/server/validation/schemas";

export const DELETE = route(async (request, context) => {
  const { businessId, feedId } = await parseParams(context, feedParams);
  const ctx = await requireTenant(request, businessId);
  await removeFeed(ctx, feedId);
  return json({ ok: true });
});
