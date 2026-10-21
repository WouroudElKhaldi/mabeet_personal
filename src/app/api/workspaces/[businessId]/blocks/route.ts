import { toDateRange } from "@/lib/dates";
import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { addBlock } from "@/server/services/calendar-service";
import { blockInput, workspaceParams } from "@/server/validation/schemas";

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  const input = await parseBody(request, blockInput);
  const block = await addBlock(ctx, {
    roomId: input.roomId,
    range: toDateRange(input),
    source: input.source ?? null,
    note: input.note ?? null,
  });
  return json(block, 201);
});
