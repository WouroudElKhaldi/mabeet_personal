import { z } from "zod";
import type { AnalyticsScope, ReportTopic } from "@/config/enums";
import { askForJson } from "@/server/ai/output";
import type { DateRange } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { invalid } from "@/server/errors";
import { assertWithinBudget, recordAiUsage } from "./ai-usage-service";
import { getAnalytics } from "./analytics-service";
import { assertPlanAllowsAi } from "./billing-service";

// The AI analytics report. The numbers come from the database (getAnalytics) and are shown by the app as charts
// and tables; DeepSeek only reads them and writes the analysis. It is told to use no number it wasn't given.

const LANGUAGES: Record<string, string> = {
  en: "English",
  ar: "Modern Standard Arabic",
  "ar-LB": "Lebanese Arabic",
};

const text = (max: number) => z.string().trim().min(1).max(max);

/** The report's exact shape: sent to the model as JSON Schema, and every answer is checked against it. */
const reportShape = (topics: readonly [ReportTopic, ...ReportTopic[]]) =>
  z.object({
    title: text(200),
    summary: text(3_000).describe("2-4 sentences"),
    highlights: z
      .array(text(400))
      .min(1)
      .max(6)
      .describe("3-6 short facts, each with a number from the data"),
    sections: z
      .array(
        z.object({
          topic: z.enum(topics),
          title: text(200),
          body: text(4_000).describe("2-5 short paragraphs, plain text with optional **bold**"),
        }),
      )
      .min(1)
      .max(topics.length),
    recommendations: z.array(text(500)).min(1).max(6).describe("3-6 concrete actions"),
  });

export type AiReport = z.infer<ReturnType<typeof reportShape>>;

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
  const [firstTopic, ...otherTopics] = input.topics;
  if (!firstTopic) throw invalid("Choose at least one topic");
  const report = await askForJson({
    system: `You are a hospitality analyst for Mabeet, a direct-booking platform for Lebanese guesthouses that charges no commission.
Write a report for the host in ${LANGUAGES[input.locale] ?? "English"} about ONLY these topics: ${input.topics.join(", ")}, one section each.
Rules: use only numbers present in the data; never invent or estimate a figure; amounts are in each place's currency (already in whole units, not cents);
say plainly when there is too little data. Be concrete and practical. No HTML, no headings, no links inside the text.`,
    input: facts,
    schema: reportShape([firstTopic, ...otherTopics]),
    maxTokens: 2_000,
    onUsage: (usage) => recordAiUsage("report", ctx.businessId, usage),
  });
  return { report, data };
}
