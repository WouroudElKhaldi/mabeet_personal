import { describe, expect, it } from "vitest";
import { canTransition } from "@/server/services/booking-status";

describe("booking status transitions", () => {
  it("lets a held booking be confirmed, declined, expired or cancelled", () => {
    for (const next of ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(canTransition("HELD", next)).toBe(true);
    }
  });

  it("lets a held booking wait for payment, and a paid one be confirmed", () => {
    expect(canTransition("HELD", "AWAITING_PAYMENT")).toBe(true);
    for (const next of ["CONFIRMED", "EXPIRED", "CANCELLED"] as const) {
      expect(canTransition("AWAITING_PAYMENT", next)).toBe(true);
    }
    expect(canTransition("AWAITING_PAYMENT", "DECLINED")).toBe(false);
    expect(canTransition("CONFIRMED", "AWAITING_PAYMENT")).toBe(false);
  });

  it("only lets a confirmed booking be cancelled", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "DECLINED")).toBe(false);
  });

  it("never revives a finished booking", () => {
    for (const finished of ["DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(canTransition(finished, "CONFIRMED")).toBe(false);
      expect(canTransition(finished, "HELD")).toBe(false);
    }
  });
});
