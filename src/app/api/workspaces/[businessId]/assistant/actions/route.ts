import { json, parseBody, tenantRoute } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { runConfirmedAction } from "@/server/services/assistant-service";
import { assistantActionInput, workspaceParams } from "@/server/validation/schemas";

const ACTIONS_PER_MINUTE = 15;

/** Carries out a change the team assistant proposed, after the member pressed Confirm on its card. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant-action:${ctx.userId}:${ctx.businessId}`, ACTIONS_PER_MINUTE, 60_000);
  const action = await parseBody(request, assistantActionInput);
  return json({ result: await runConfirmedAction(ctx, action) });
});
