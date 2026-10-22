import { toDateRange } from "@/lib/dates";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { moveBlock, removeBlock } from "@/server/services/calendar-service";
import { blockMoveInput, blockParams } from "@/server/validation/schemas";

/** Moves a block to other nights or another room (drag and drop on the calendar). */
export const PATCH = tenantRoute(blockParams, async ({ request, ctx, params: { blockId } }) => {
  const input = await parseBody(request, blockMoveInput);
  await moveBlock(ctx, blockId, { roomId: input.roomId, range: toDateRange(input) });
  return json({ ok: true });
});

export const DELETE = tenantRoute(blockParams, async ({ ctx, params: { blockId } }) => {
  await removeBlock(ctx, blockId);
  return json({ ok: true });
});
