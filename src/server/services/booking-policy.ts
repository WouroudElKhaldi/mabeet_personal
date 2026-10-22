import type {
  BookingMode,
  BookingStatus,
  OnlineAmount,
  PaymentCollection,
  RefundPolicy,
} from "@prisma/client";

// The host's booking and payment settings, turned into what happens to one booking. Pure functions, so the
// rules are easy to test and read in one place.

export interface BookingTerms {
  bookingMode: BookingMode;
  paymentCollection: PaymentCollection;
  onlineAmount: OnlineAmount;
}

/** How long a guest has to pay online once the booking is theirs. Instant bookings wait less. */
const INSTANT_PAYMENT_MINUTES = 30;

/** How long a guest has to pay online after the host accepts their request. */
export const PAY_AFTER_ACCEPT_HOURS = 24;

/**
 * Where a new booking starts:
 * - request, paid to the host → HELD until the host decides
 * - request, paid online       → HELD until the host accepts, then AWAITING_PAYMENT
 * - instant, paid to the host  → CONFIRMED at once
 * - instant, paid online       → AWAITING_PAYMENT, CONFIRMED when the payment lands
 */
export function initialStatus(terms: BookingTerms): BookingStatus {
  if (terms.bookingMode === "REQUEST") return "HELD";
  return terms.paymentCollection === "ONLINE" ? "AWAITING_PAYMENT" : "CONFIRMED";
}

/** How long a new booking may wait: the host's answer time for a request, a short time to pay an instant one. */
export function holdUntil(status: BookingStatus, holdHours: number, now: Date): Date | null {
  if (status === "HELD") return new Date(now.getTime() + holdHours * 3_600_000);
  if (status === "AWAITING_PAYMENT") return new Date(now.getTime() + INSTANT_PAYMENT_MINUTES * 60_000);
  return null;
}

/** Where a host's "confirm" takes a held booking: straight to confirmed, or to waiting for the online payment. */
export function statusOnAccept(onlineDueCents: number | null): BookingStatus {
  return onlineDueCents === null ? "CONFIRMED" : "AWAITING_PAYMENT";
}

/** What the guest pays online when the host collects online; null when they pay the host directly. */
export function onlineDue(
  terms: BookingTerms,
  price: { totalCents: number; depositCents: number },
): number | null {
  if (terms.paymentCollection !== "ONLINE") return null;
  const due = terms.onlineAmount === "FULL" ? price.totalCents : price.depositCents;
  // A 0% deposit would leave nothing to pay online; the whole stay is charged instead.
  return due > 0 ? due : price.totalCents;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Share of the paid amount a guest gets back, by policy and full days left before the stay or session. */
function refundShare(policy: RefundPolicy, daysBefore: number): number {
  switch (policy) {
    case "FLEXIBLE":
      return daysBefore >= 1 ? 1 : 0;
    case "MODERATE":
      return daysBefore >= 5 ? 1 : 0.5;
    case "STRICT":
      return daysBefore >= 7 ? 0.5 : 0;
    case "NON_REFUNDABLE":
      return 0;
  }
}

export type CancelledBy = "guest" | "host" | "system";

/**
 * What goes back to the guest from what they paid online. The host cancelling or declining, or Mabeet
 * expiring a booking that was paid too late, always refunds in full. A guest cancelling gets the policy's share.
 */
export function refundCents(input: {
  paidCents: number;
  policy: RefundPolicy;
  by: CancelledBy;
  startsAt: Date;
  now: Date;
}): number {
  if (input.paidCents <= 0) return 0;
  if (input.by !== "guest") return input.paidCents;
  const daysBefore = Math.floor((input.startsAt.getTime() - input.now.getTime()) / DAY_MS);
  return Math.round(input.paidCents * refundShare(input.policy, daysBefore));
}
