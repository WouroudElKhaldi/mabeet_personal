import type { Prisma } from "@prisma/client";
import { json, optionalUser, parseBody, route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { askConcierge } from "@/server/services/assistant-service";
import { getChat, saveTurn } from "@/server/services/chat-service";
import { chatInput } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 8;

/**
 * The public trip concierge. Rate limited per address because every call costs money. Signed-in guests' chats
 * are saved (with the place cards shown) unless temporary; visitors' are never stored.
 */
export const POST = route(async (request) => {
  await enforceRateLimit(`concierge:${clientAddress(request)}`, MESSAGES_PER_MINUTE, 60_000);
  const { messages, chatId, temporary } = await parseBody(request, chatInput);
  const user = await optionalUser(request);
  const scope = user && { userId: user.id, surface: "concierge" as const, businessId: null };
  // A chat that isn't theirs is refused before paying for an answer.
  if (scope && chatId && !temporary) await getChat(scope, chatId);
  const answer = await askConcierge(messages);
  if (!scope || temporary) return json({ ...answer, chatId: null });
  const saved = await saveTurn(scope, chatId ?? null, messages.at(-1)!.content, {
    content: answer.reply,
    data: { places: answer.places } as unknown as Prisma.InputJsonValue,
  });
  return json({ ...answer, chatId: saved });
});
