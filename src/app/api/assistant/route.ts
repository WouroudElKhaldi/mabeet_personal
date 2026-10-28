import { jobResponse, optionalUser, parseBody, route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { chatSeconds, conciergeJob } from "@/server/jobs/ai-jobs";
import { assertAiAvailable } from "@/server/services/assistant-service";
import { runOrQueue } from "@/server/jobs/queue";
import { chatInput } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 8;

/**
 * The public trip concierge. Rate limited per address because every call costs money. Signed-in guests' chats
 * are saved (with the place cards shown) unless temporary; visitors' are never stored. A short question on a
 * quiet server is answered at once (200); a long one, or any while others wait, is queued (202 + jobId).
 */
export const POST = route(async (request) => {
  await enforceRateLimit(`concierge:${clientAddress(request)}`, MESSAGES_PER_MINUTE, 60_000);
  const chat = await parseBody(request, chatInput);
  const user = await optionalUser(request);
  await assertAiAvailable(null);
  return jobResponse(
    await runOrQueue(
      conciergeJob,
      { userId: user?.id ?? null, chat },
      chatSeconds("concierge", chat.messages),
    ),
  );
});
