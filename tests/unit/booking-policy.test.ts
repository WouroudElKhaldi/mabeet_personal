import { describe, expect, it } from "vitest";
import {
  holdUntil,
  initialStatus,
  onlineDue,
  refundCents,
  statusOnAccept,
} from "@/server/services/booking-policy";

const terms = (
  bookingMode: "REQUEST" | "INSTANT",
  paymentCollection: "AT_PLACE" | "ONLINE",
  onlineAmount: "DEPOSIT" | "FULL" = "DEPOSIT",
) => ({ bookingMode, paymentCollection, onlineAmount });

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-01T10:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * DAY);

describe("where a booking starts", () => {
  it("covers the four ways a host can work", () => {
    expect(initialStatus(terms("REQUEST", "AT_PLACE"))).toBe("HELD");
    expect(initialStatus(terms("REQUEST", "ONLINE"))).toBe("HELD");
    expect(initialStatus(terms("INSTANT", "AT_PLACE"))).toBe("CONFIRMED");
    expect(initialStatus(terms("INSTANT", "ONLINE"))).toBe("AWAITING_PAYMENT");
  });

  it("sends an accepted request to payment only when the host collects online", () => {
    expect(statusOnAccept(null)).toBe("CONFIRMED");
    expect(statusOnAccept(3_000)).toBe("AWAITING_PAYMENT");
  });

  it("gives a request the host's answer time, an instant online booking 30 minutes, a confirmed one none", () => {
    expect(holdUntil("HELD", 24, now)).toEqual(inDays(1));
    expect(holdUntil("AWAITING_PAYMENT", 24, now)).toEqual(new Date(now.getTime() + 30 * 60_000));
    expect(holdUntil("CONFIRMED", 24, now)).toBeNull();
  });
});

describe("what is paid online", () => {
  const price = { totalCents: 30_000, depositCents: 9_000 };

  it("is nothing when the guest pays the host directly", () => {
    expect(onlineDue(terms("INSTANT", "AT_PLACE"), price)).toBeNull();
  });

  it("is the deposit or the full amount, as the host chose", () => {
    expect(onlineDue(terms("INSTANT", "ONLINE", "DEPOSIT"), price)).toBe(9_000);
    expect(onlineDue(terms("INSTANT", "ONLINE", "FULL"), price)).toBe(30_000);
  });

  it("charges the whole stay when the deposit is 0%", () => {
    expect(onlineDue(terms("REQUEST", "ONLINE"), { totalCents: 30_000, depositCents: 0 })).toBe(30_000);
  });
});

describe("refunds", () => {
  const refund = (
    policy: "FLEXIBLE" | "MODERATE" | "STRICT" | "NON_REFUNDABLE",
    days: number,
    by: "guest" | "host" = "guest",
  ) => refundCents({ paidCents: 10_000, policy, by, startsAt: inDays(days), now });

  it("always gives everything back when the host or Mabeet ends the booking", () => {
    expect(refund("NON_REFUNDABLE", 0, "host")).toBe(10_000);
    expect(refundCents({ paidCents: 10_000, policy: "STRICT", by: "system", startsAt: now, now })).toBe(
      10_000,
    );
  });

  it("follows the policy when the guest cancels", () => {
    expect(refund("FLEXIBLE", 1)).toBe(10_000);
    expect(refund("FLEXIBLE", 0.5)).toBe(0);
    expect(refund("MODERATE", 5)).toBe(10_000);
    expect(refund("MODERATE", 4)).toBe(5_000);
    expect(refund("STRICT", 7)).toBe(5_000);
    expect(refund("STRICT", 6)).toBe(0);
    expect(refund("NON_REFUNDABLE", 30)).toBe(0);
  });

  it("refunds nothing when nothing was paid", () => {
    expect(refundCents({ paidCents: 0, policy: "FLEXIBLE", by: "host", startsAt: now, now })).toBe(0);
  });
});
