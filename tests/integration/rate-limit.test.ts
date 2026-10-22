import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { cleanUpRateLimits, enforceRateLimit } from "@/server/http/rate-limit";
import { prisma, resetDatabase } from "./helpers";

describe("rate limits shared through Postgres", () => {
  beforeEach(resetDatabase);

  it("lets exactly the limit through when requests arrive at the same moment", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => enforceRateLimit("test:burst", 5, 60_000)),
    );
    const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    for (const { reason } of refused) {
      expect(reason).toBeInstanceOf(AppError);
      expect((reason as AppError).code).toBe("RATE_LIMITED");
    }
  });

  it("starts a fresh window once the old one has ended", async () => {
    await enforceRateLimit("test:window", 1, 60_000);
    await expect(enforceRateLimit("test:window", 1, 60_000)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await prisma.rateLimitWindow.update({
      where: { key: "test:window" },
      data: { resetAt: new Date(Date.now() - 1) },
    });
    await expect(enforceRateLimit("test:window", 1, 60_000)).resolves.toBeUndefined();
  });

  it("keeps separate keys apart and cleans up old windows", async () => {
    await enforceRateLimit("test:a", 1, 60_000);
    await expect(enforceRateLimit("test:b", 1, 60_000)).resolves.toBeUndefined();
    await prisma.rateLimitWindow.updateMany({ data: { resetAt: new Date(Date.now() - 2 * 3_600_000) } });
    expect(await cleanUpRateLimits()).toBe(2);
  });
});
