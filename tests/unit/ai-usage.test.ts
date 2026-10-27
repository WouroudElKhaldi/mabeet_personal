import { beforeEach, describe, expect, it, vi } from "vitest";

// Prices of 1 micro-dollar per token make costs easy to read: a call's cost equals its token count.
vi.mock("@/server/env", () => ({
  env: {
    AI_MONTHLY_BUDGET_USD: 50,
    AI_INPUT_USD_PER_M: 1,
    AI_OUTPUT_USD_PER_M: 1,
    BETTER_AUTH_URL: "https://mabeet.test",
  },
}));
vi.mock("@/server/db/client", () => ({ prisma: {} }));

const ledger = vi.hoisted(() => ({ spentMicro: 0, recorded: [] as number[] }));
vi.mock("@/server/repositories/ai-usage-repository", () => ({
  sumCostSince: vi.fn(async () => ledger.spentMicro),
  recordUsage: vi.fn(async (_db: unknown, usage: { costMicroUsd: number }) => {
    ledger.recorded.push(usage.costMicroUsd);
    ledger.spentMicro += usage.costMicroUsd;
    return { id: "usage" };
  }),
  listSuperAdmins: vi.fn(async () => [{ id: "admin-1", email: "admin@mabeet.test" }]),
  sumUsageSince: vi.fn(async () => []),
}));

// Background work runs at once here, and is collected so each test can wait for it.
const pending = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("@/server/background", () => ({
  inBackground: (_label: string, work: () => Promise<unknown>) => pending.push(work()),
}));
const sendEmail = vi.hoisted(() => vi.fn(async (_message: { idempotencyKey: string }) => undefined));
const pushToPeople = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/email/send", () => ({ sendEmail }));
vi.mock("@/server/services/push-service", () => ({ pushToPeople }));

const { assertWithinBudget, recordAiUsage } = await import("@/server/services/ai-usage-service");

const BUDGET_MICRO = 50_000_000;
const settle = () => Promise.all(pending.splice(0));
const answerCosting = async (micro: number) => {
  recordAiUsage("team", "business-1", { promptTokens: micro, completionTokens: 0 });
  await settle();
};

beforeEach(() => {
  ledger.spentMicro = 0;
  ledger.recorded = [];
  sendEmail.mockClear();
  pushToPeople.mockClear();
});

describe("AI budget", () => {
  it("answers while the month's spend is under the budget", async () => {
    ledger.spentMicro = BUDGET_MICRO - 1;
    await expect(assertWithinBudget()).resolves.toBeUndefined();
  });

  it("pauses the assistants once the budget is spent", async () => {
    ledger.spentMicro = BUDGET_MICRO;
    await expect(assertWithinBudget()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("records each answer's cost from its tokens", async () => {
    recordAiUsage("concierge", null, { promptTokens: 1_200, completionTokens: 300 });
    await settle();
    expect(ledger.recorded).toEqual([1_500]);
  });

  it("warns the admins once, on the answer that crosses 80%", async () => {
    ledger.spentMicro = BUDGET_MICRO * 0.8 - 10;
    await answerCosting(20);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(pushToPeople).toHaveBeenCalledTimes(1);

    await answerCosting(20);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("tells the admins again when an answer reaches 100%", async () => {
    ledger.spentMicro = BUDGET_MICRO - 10;
    await answerCosting(20);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ idempotencyKey: expect.stringMatching(/-1$/) });
  });

  it("stays quiet well under the budget", async () => {
    await answerCosting(1_000);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
