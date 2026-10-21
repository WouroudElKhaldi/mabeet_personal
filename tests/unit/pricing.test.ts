import { describe, expect, it } from "vitest";
import { parseIsoDate } from "@/lib/dates";
import { quoteStay } from "@/server/services/pricing";

describe("quoteStay", () => {
  const range = { checkIn: parseIsoDate("2026-10-30"), checkOut: parseIsoDate("2026-11-02") };

  it("uses the base rate unless a night has an override", () => {
    const quote = quoteStay({
      range,
      baseRateCents: 8_000,
      overrides: new Map([["2026-10-31", 12_000]]),
      depositPercent: 30,
    });
    expect(quote.nights.map((night) => night.rateCents)).toEqual([8_000, 12_000, 8_000]);
    expect(quote.totalCents).toBe(28_000);
    expect(quote.depositCents).toBe(8_400);
  });

  it("rounds the deposit up to the next cent", () => {
    const quote = quoteStay({ range, baseRateCents: 3_333, overrides: new Map(), depositPercent: 30 });
    expect(quote.totalCents).toBe(9_999);
    expect(quote.depositCents).toBe(3_000);
  });
});
