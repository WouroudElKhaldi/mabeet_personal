import { json, parseBody, tenantRoute } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { askTeamAssistant } from "@/server/services/assistant-service";
import { chatInput, workspaceParams } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 15;

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.membershipId}`, MESSAGES_PER_MINUTE, 60_000);
  const { messages } = await parseBody(request, chatInput);
  return json(await askTeamAssistant(ctx, messages));
});
