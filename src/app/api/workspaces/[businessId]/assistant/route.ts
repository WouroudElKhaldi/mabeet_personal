import { jobResponse, parseBody, tenantRoute } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { chatSeconds, teamAssistantJob } from "@/server/jobs/ai-jobs";
import { runOrQueue } from "@/server/jobs/queue";
import { requirePermission } from "@/server/auth/tenant-context";
import { assertAiAvailable } from "@/server/services/assistant-service";
import { chatInput, workspaceParams } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 15;

/**
 * Asks the team assistant. Saved to the member's chat history unless the chat is temporary. Answered at once
 * (200) when short and the server is quiet, otherwise queued (202 + jobId).
 */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.userId}:${ctx.businessId}`, MESSAGES_PER_MINUTE, 60_000);
  // Refused here, before queueing, as well as in the job itself.
  requirePermission(ctx, "ai.use");
  await assertAiAvailable(ctx.businessId);
  const chat = await parseBody(request, chatInput);
  const job = { userId: ctx.userId, businessId: ctx.businessId, chat };
  return jobResponse(await runOrQueue(teamAssistantJob, job, chatSeconds("team", chat.messages)));
});
