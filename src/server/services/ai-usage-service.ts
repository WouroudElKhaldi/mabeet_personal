import type { TokenUsage } from "@/server/ai/deepseek";
import { prisma } from "@/server/db/client";
import { inBackground } from "@/server/email/background";
import { sendEmail } from "@/server/email/send";
import { render } from "@/server/email/templates";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";
import * as usageRepo from "@/server/repositories/ai-usage-repository";
import { pushToPeople } from "./push-service";

// What the assistants cost, against the monthly budget (AI_MONTHLY_BUDGET_USD, $50 by default).

const MICRO = 1_000_000;
/** Share of the budget at which admins get a warning email. */
const WARN_AT = 0.8;

export type AiSurface = "concierge" | "team" | "report";

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const budgetMicro = () => Math.round(env.AI_MONTHLY_BUDGET_USD * MICRO);

function costOf(usage: TokenUsage): number {
  return Math.round(
    usage.promptTokens * env.AI_INPUT_USD_PER_M + usage.completionTokens * env.AI_OUTPUT_USD_PER_M,
  );
}

/** Refuses a new question once this month's spend has reached the budget. */
export async function assertWithinBudget(now = new Date()): Promise<void> {
  const budget = budgetMicro();
  if ((await usageRepo.sumCostSince(prisma, monthStart(now))) >= budget) {
    throw unavailable("The assistant is resting until next month. Search and booking still work.");
  }
}

/**
 * Records one answer's tokens and cost. When this answer is the one that crosses 80% or 100% of the
 * budget, the super admins get one email: only the crossing request sends it, so it goes once.
 */
export async function recordAiUsage(
  surface: AiSurface,
  businessId: string | null,
  usage: TokenUsage,
  now = new Date(),
): Promise<void> {
  const cost = costOf(usage);
  await usageRepo.recordUsage(prisma, { surface, businessId, ...usage, costMicroUsd: cost });
  const budget = budgetMicro();
  const after = await usageRepo.sumCostSince(prisma, monthStart(now));
  const before = after - cost;
  const crossed = [1, WARN_AT].find((share) => before < budget * share && after >= budget * share);
  if (crossed !== undefined) alertAdmins(crossed, after, budget, now);
}

function alertAdmins(share: number, spentMicro: number, budgetMicroUsd: number, now: Date) {
  inBackground("AI budget alert", async () => {
    const admins = await usageRepo.listSuperAdmins(prisma);
    if (admins.length === 0) return;
    const usd = (micro: number) => `$${(micro / MICRO).toFixed(2)}`;
    const month = now.toISOString().slice(0, 7);
    const full = share >= 1;
    const title = full ? "The assistants are paused until next month" : "AI spend is at 80% of the budget";
    const spent = `This month: ${usd(spentMicro)} of ${usd(budgetMicroUsd)}.`;
    const adminPage = new URL("/admin", env.BETTER_AUTH_URL).toString();
    await Promise.all([
      sendEmail({
        to: admins.map((admin) => admin.email),
        idempotencyKey: `ai-budget-${month}-${share}`,
        ...render(full ? "AI budget reached: assistants paused" : "AI budget at 80%", {
          kicker: "AI budget",
          title,
          body: [
            spent,
            full
              ? "Guests and teams see a short notice instead of the assistant. Raise AI_MONTHLY_BUDGET_USD to turn it back on."
              : "At 100% the assistants pause until the 1st. Raise AI_MONTHLY_BUDGET_USD if that is too soon.",
          ],
          action: { label: "Open the admin page", url: adminPage },
        }),
      }),
      pushToPeople(
        admins.map((admin) => admin.id),
        () => ({ title, body: spent, url: adminPage }),
      ),
    ]);
  });
}

/** For the admin page: this month's spend and tokens, per surface, and the budget. */
export async function getMonthlyAiUsage(now = new Date()) {
  const rows = await usageRepo.sumUsageSince(prisma, monthStart(now));
  const surfaces = rows.map((row) => ({
    surface: row.surface,
    answers: row._count._all,
    tokens: (row._sum.promptTokens ?? 0) + (row._sum.completionTokens ?? 0),
    costMicroUsd: row._sum.costMicroUsd ?? 0,
  }));
  return {
    surfaces,
    costMicroUsd: surfaces.reduce((sum, row) => sum + row.costMicroUsd, 0),
    budgetMicroUsd: budgetMicro(),
  };
}
