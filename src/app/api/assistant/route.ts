import { json, parseBody, route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { askConcierge } from "@/server/services/assistant-service";
import { chatInput } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 8;

/** The public trip concierge. Rate limited per address because every call costs money. */
export const POST = route(async (request) => {
  await enforceRateLimit(`concierge:${clientAddress(request)}`, MESSAGES_PER_MINUTE, 60_000);
  const { messages } = await parseBody(request, chatInput);
  return json(await askConcierge(messages));
});
