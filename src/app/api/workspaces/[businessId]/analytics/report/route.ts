import { invalid } from "@/server/errors";
import { requirePermission } from "@/server/auth/tenant-context";
import { requestLocale } from "@/server/http/error-i18n";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jobResponse, parseBody, tenantRoute } from "@/server/http/route";
import { reportJob, reportSeconds } from "@/server/jobs/ai-jobs";
import { runOrQueue } from "@/server/jobs/queue";
import { assertAiAvailable } from "@/server/services/assistant-service";
import { reportInput, workspaceParams } from "@/server/validation/schemas";

const MAX_DAYS = 731;

/**
 * Writes an AI analysis of the chosen period and places from the database's numbers. Pro and Business plans.
 * A report takes 20 seconds or more, so with a worker running it is queued (202 + jobId).
 */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`report:${ctx.userId}`, 6, 60 * 60_000);
  requirePermission(ctx, "analytics.read");
  requirePermission(ctx, "ai.use");
  await assertAiAvailable(ctx.businessId);
  const input = await parseBody(request, reportInput);
  const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000;
  if (!(days >= 1 && days <= MAX_DAYS)) throw invalid("Pick a period between one day and two years");
  const job = { ...input, userId: ctx.userId, businessId: ctx.businessId, locale: requestLocale(request) };
  return jobResponse(await runOrQueue(reportJob, job, reportSeconds(days, input.topics.length)));
});
