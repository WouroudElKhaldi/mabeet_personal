import { toDateRange } from "@/lib/dates";
import { invalid } from "@/server/errors";
import { requestLocale } from "@/server/http/error-i18n";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { generateReport } from "@/server/services/report-service";
import { reportInput, workspaceParams } from "@/server/validation/schemas";

const MAX_DAYS = 731;

/** Writes an AI analysis of the chosen period and places from the database's numbers. Pro and Business plans. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`report:${ctx.userId}`, 6, 60 * 60_000);
  const input = await parseBody(request, reportInput);
  const range = toDateRange({ checkIn: input.from, checkOut: input.to });
  const days = (range.checkOut.getTime() - range.checkIn.getTime()) / 86_400_000;
  if (days < 1 || days > MAX_DAYS) throw invalid("Pick a period between one day and two years");
  return json(await generateReport(ctx, { ...input, range, locale: requestLocale(request) }));
});
