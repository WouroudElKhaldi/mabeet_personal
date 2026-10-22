import { z } from "zod";
import { completeJson } from "@/server/ai/deepseek";
import type { TenantContext } from "@/server/auth/tenant-context";
import { requirePermission } from "@/server/auth/tenant-context";
import type { DateRange } from "@/lib/dates";
import { unavailable } from "@/server/errors";
import { assertWithinBudget, recordAiUsage } from "./ai-usage-service";
import { type AnalyticsScope, getAnalytics } from "./analytics-service";
import { assertPlanAllowsAi } from "./billing-service";

// The AI analytics report. The numbers come from the database (getAnalytics) and are shown by the app as charts
// and tables; DeepSeek only reads them and writes the analysis. It is told to use no number it wasn't given.

/** What a report can cover; the request schema lists the same values. */
type ReportTopic = "occupancy" | "revenue" | "channels" | "requests" | "reviews" | "places";

const LANGUAGES: Record<string, string> = {
  en: "English",
  ar: "Modern Standard Arabic",
  "ar-LB": "Lebanese Arabic",
};

const reportShape = z.object({
  title: z.string().max(200).catch("Report"),
  summary: z.string().max(3000).catch(""),
  highlights: z.array(z.string().max(400)).max(8).catch([]),
  sections: z
    .array(z.object({ topic: z.string().max(40), title: z.string().max(200), body: z.string().max(4000) }))
    .max(8)
    .catch([]),
  recommendations: z.array(z.string().max(500)).max(8).catch([]),
});

export type AiReport = z.infer<typeof reportShape>;

/**
 * Builds the report for one place or all the person's places over a period. Pro and Business plans only, within
 * the platform's AI budget; every report's tokens are recorded.
 */
export async function generateReport(
  ctx: TenantContext,
  input: { scope: AnalyticsScope; range: DateRange; topics: ReportTopic[]; locale: string },
) {
  requirePermission(ctx, "analytics.read");
  requirePermission(ctx, "ai.use");
  await assertPlanAllowsAi(ctx.businessId);
  await assertWithinBudget();
  const data = await getAnalytics(ctx, input.scope, input.range);
  const facts = {
    period: data.range,
    places: data.places.map((place) => ({
      name: place.name,
      currency: place.report.currency,
      occupancyRate: Number(place.report.occupancyRate.toFixed(3)),
      nightsSold: place.report.nightsSold,
      nightsAvailable: place.report.nightsAvailable,
      directRevenue: place.report.directRevenueCents / 100,
      averageNightlyRate:
        place.report.averageDailyRateCents === null ? null : place.report.averageDailyRateCents / 100,
      commissionSaved: place.report.commissionSavedCents / 100,
      channels: place.report.channels,
      nightsByMonth: place.report.monthly,
      revenueByMonth: place.revenueByMonth.map((row) => ({ ...row, amount: row.cents / 100 })),
      requestsByStatus: place.report.requests,
      medianResponseMinutes: place.report.medianResponseMinutes,
      rating: place.report.rating,
    })),
  };
  const { content, usage } = await completeJson(
    [
      {
        role: "system",
        content: `You are a hospitality analyst for Mabeet, a direct-booking platform for Lebanese guesthouses that charges no commission.
Write a report for the host in ${LANGUAGES[input.locale] ?? "English"} about ONLY these topics: ${input.topics.join(", ")}.
Rules: use only numbers present in the data; never invent or estimate a figure; amounts are in each place's currency (already in whole units, not cents);
say plainly when there is too little data. Be concrete and practical. Return JSON:
{"title": string, "summary": string, "highlights": string[] (3-6 short facts with numbers),
"sections": [{"topic": one of the requested topics, "title": string, "body": string (2-5 short paragraphs)}],
"recommendations": string[] (3-6 concrete actions)}`,
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
    2_000,
  );
  await recordAiUsage("report", ctx.businessId, usage);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw unavailable("The report couldn't be written this time. Please try again.");
  }
  return { report: reportShape.parse(parsed), data };
}
