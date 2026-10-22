import { json, parseBody, tenantRoute } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { askTeamAssistant } from "@/server/services/assistant-service";
import { getChat, saveTurn } from "@/server/services/chat-service";
import { chatInput, workspaceParams } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 15;

/** Asks the team assistant. Saved to the member's chat history unless the chat is temporary. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.userId}:${ctx.businessId}`, MESSAGES_PER_MINUTE, 60_000);
  const { messages, chatId, temporary } = await parseBody(request, chatInput);
  const scope = { userId: ctx.userId, surface: "team" as const, businessId: ctx.businessId };
  // A chat that isn't theirs is refused before paying for an answer.
  if (chatId && !temporary) await getChat(scope, chatId);
  const answer = await askTeamAssistant(ctx, messages);
  if (temporary) return json({ ...answer, chatId: null });
  const saved = await saveTurn(scope, chatId ?? null, messages.at(-1)!.content, {
    content: answer.reply,
    data: null,
  });
  return json({ ...answer, chatId: saved });
});
