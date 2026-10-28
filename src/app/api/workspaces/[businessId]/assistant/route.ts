import { json, parseBody, tenantRoute } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { askTeamAssistant } from "@/server/services/assistant-service";
import { answerChat } from "@/server/services/chat-service";
import { chatInput, workspaceParams } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 15;

/** Asks the team assistant. Saved to the member's chat history unless the chat is temporary. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.userId}:${ctx.businessId}`, MESSAGES_PER_MINUTE, 60_000);
  const input = await parseBody(request, chatInput);
  const scope = { userId: ctx.userId, surface: "team" as const, businessId: ctx.businessId };
  return json(await answerChat(scope, input, (history) => askTeamAssistant(ctx, history)));
});
