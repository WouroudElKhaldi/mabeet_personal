import { json, parseParams, requireTenant, route } from "@/server/http/route";
import { removeBlock } from "@/server/services/calendar-service";
import { blockParams } from "@/server/validation/schemas";

export const DELETE = route(async (request, context) => {
  const { businessId, blockId } = await parseParams(context, blockParams);
  const ctx = await requireTenant(request, businessId);
  await removeBlock(ctx, blockId);
  return json({ ok: true });
});
