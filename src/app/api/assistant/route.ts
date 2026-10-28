import { json, optionalUser, parseBody, route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { askConcierge } from "@/server/services/assistant-service";
import { answerChat } from "@/server/services/chat-service";
import { chatInput } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 8;

/**
 * The public trip concierge. Rate limited per address because every call costs money. Signed-in guests' chats
 * are saved (with the place cards shown) unless temporary; visitors' are never stored.
 */
export const POST = route(async (request) => {
  await enforceRateLimit(`concierge:${clientAddress(request)}`, MESSAGES_PER_MINUTE, 60_000);
  const input = await parseBody(request, chatInput);
  const user = await optionalUser(request);
  const scope = user && { userId: user.id, surface: "concierge" as const, businessId: null };
  return json(await answerChat(scope, input, askConcierge, (answer) => ({ places: answer.places })));
});
