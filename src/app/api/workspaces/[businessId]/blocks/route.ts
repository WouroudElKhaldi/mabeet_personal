import { toDateRange } from "@/lib/dates";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { addBlock } from "@/server/services/calendar-service";
import { blockInput, workspaceParams } from "@/server/validation/schemas";

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const input = await parseBody(request, blockInput);
  const block = await addBlock(ctx, {
    roomId: input.roomId,
    range: toDateRange(input),
    source: input.source ?? null,
    note: input.note ?? null,
  });
  return json(block, 201);
});
