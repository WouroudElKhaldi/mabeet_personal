import { json, tenantRoute } from "@/server/http/route";
import { removeBlock } from "@/server/services/calendar-service";
import { blockParams } from "@/server/validation/schemas";

export const DELETE = tenantRoute(blockParams, async ({ ctx, params: { blockId } }) => {
  await removeBlock(ctx, blockId);
  return json({ ok: true });
});
