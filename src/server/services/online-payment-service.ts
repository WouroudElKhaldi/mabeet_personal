import type { BookingStatus, Payment, RefundPolicy } from "@prisma/client";
import { env } from "@/server/env";
import { conflict, invalid, notFound } from "@/server/errors";
import {
  createPaymentCheckout,
  createStripeRefund,
  retrieveCheckoutSession,
  stripeEnabled,
  supportsCard,
} from "@/server/billing/stripe";
import { prisma, runInTransaction } from "@/server/db/client";
import {
  createWhishPayment,
  getWhishStatus,
  refundWhishPayment,
  supportsWhish,
  whishEnabled,
} from "@/server/payments/whish";
import { logActivity } from "@/server/repositories/activity-repository";
import * as bookings from "@/server/repositories/booking-repository";
import * as money from "@/server/repositories/money-repository";
import type { Payable } from "@/server/repositories/money-repository";
import * as offerings from "@/server/repositories/offering-repository";
import { type CancelledBy, refundCents } from "./booking-policy";
import { notifyBookingStatus, notifyOnlinePayment, notifyRefund } from "./notification-service";

// Guests paying online into Mabeet's Whish or Stripe account. Mabeet keeps no fee: every cent is owed to the
// host (see payout-service). A callback or a returning guest only triggers a check; the provider's own answer
// decides, so a forged callback can't confirm a booking.

export type OnlineMethod = "WHISH" | "CARD";

const appUrl = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();

/** A stay or a session booking, reduced to what paying for it needs. */
interface PayableBooking {
  payable: Payable;
  id: string;
  kind: "stay" | "session";
  businessId: string;
  reference: string;
  publicToken: string;
  status: BookingStatus;
  onlineDueCents: number | null;
  currency: string;
  holdExpiresAt: Date | null;
  guestEmail: string | null;
  refundPolicy: RefundPolicy;
  /** When the stay or the session begins, for refund policies. */
  startsAt: Date;
  description: string;
  payments: Payment[];
}

async function findPayableByToken(token: string): Promise<PayableBooking | null> {
  const stay = await bookings.findBookingByPublicToken(prisma, token);
  if (stay) {
    return {
      payable: { kind: "stay", bookingId: stay.id },
      id: stay.id,
      kind: "stay",
      businessId: stay.businessId,
      reference: stay.reference,
      publicToken: stay.publicToken,
      status: stay.status,
      onlineDueCents: stay.onlineDueCents,
      currency: stay.currency,
      holdExpiresAt: stay.holdExpiresAt,
      guestEmail: stay.guestEmail,
      refundPolicy: stay.refundPolicy,
      startsAt: stay.checkIn,
      description: `${stay.business.name} · ${stay.room.name} · ${stay.reference}`,
      payments: stay.payments,
    };
  }
  const session = await offerings.findSessionBookingByToken(prisma, token);
  if (!session) return null;
  return {
    payable: { kind: "session", sessionBookingId: session.id },
    id: session.id,
    kind: "session",
    businessId: session.businessId,
    reference: session.reference,
    publicToken: session.publicToken,
    status: session.status,
    onlineDueCents: session.onlineDueCents,
    currency: session.currency,
    holdExpiresAt: session.holdExpiresAt,
    guestEmail: session.guestEmail,
    refundPolicy: session.refundPolicy,
    startsAt: session.session.startsAt,
    description: `${session.business.name} · ${session.offering.title} · ${session.reference}`,
    payments: session.payments,
  };
}

/** Which ways to pay this booking online are open, for the guest's page. */
export function onlineMethodsFor(currency: string): OnlineMethod[] {
  const methods: OnlineMethod[] = [];
  if (whishEnabled() && supportsWhish(currency)) methods.push("WHISH");
  if (stripeEnabled() && supportsCard(currency)) methods.push("CARD");
  return methods;
}

/** Starts paying a booking that waits for its online payment. Returns the Whish or Stripe page to go to. */
export async function startBookingCheckout(token: string, method: OnlineMethod, now = new Date()) {
  const booking = await findPayableByToken(token);
  if (!booking) throw notFound("Booking");
  if (booking.status !== "AWAITING_PAYMENT" || booking.onlineDueCents === null) {
    throw conflict("This booking has nothing to pay online right now.");
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < now) {
    throw conflict("The time to pay has run out. Please book again.");
  }
  if (booking.payments.some((payment) => payment.online && payment.status === "PAID")) {
    throw conflict("This booking is already paid.");
  }
  if (!onlineMethodsFor(booking.currency).includes(method)) {
    throw invalid(
      method === "WHISH" ? "Whish can't take this currency." : "Cards can't be used for this currency.",
    );
  }

  const payment = await money.createOnlinePayment(prisma, {
    businessId: booking.businessId,
    payable: booking.payable,
    amountCents: booking.onlineDueCents,
    currency: booking.currency,
    method: method === "WHISH" ? "WHISH" : "STRIPE",
  });
  const back = appUrl(`/b/${booking.publicToken}?payment=${payment.id}`);

  if (method === "WHISH") {
    const url = await createWhishPayment({
      externalId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      invoice: booking.description,
      successCallbackUrl: appUrl(`/api/payments/whish/callback?payment=${payment.id}`),
      failureCallbackUrl: appUrl(`/api/payments/whish/callback?payment=${payment.id}&attempt=failed`),
      successRedirectUrl: back,
      failureRedirectUrl: back,
    });
    await money.setCheckout(prisma, payment.id, { providerRef: `whish:${payment.id}`, checkoutUrl: url });
    return url;
  }

  const session = await createPaymentCheckout({
    paymentId: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    description: booking.description,
    email: booking.guestEmail,
    successUrl: back,
    cancelUrl: appUrl(`/b/${booking.publicToken}`),
  });
  await money.setCheckout(prisma, payment.id, { providerRef: session.id, checkoutUrl: session.url });
  return session.url;
}

type Verdict =
  { paid: true; providerPaymentId: string | null; note: string | null } | { paid: false; final: boolean };

/** Asks Whish or Stripe what really happened to a payment. */
async function verify(payment: Payment): Promise<Verdict> {
  if (payment.method === "WHISH") {
    const { status, payerPhone } = await getWhishStatus(payment.id, payment.currency);
    if (status === "success")
      return { paid: true, providerPaymentId: null, note: payerPhone && `Whish ${payerPhone}` };
    return { paid: false, final: status === "failed" };
  }
  if (!payment.providerRef) return { paid: false, final: false };
  const session = await retrieveCheckoutSession(payment.providerRef);
  if (session.payment_status === "paid") {
    return { paid: true, providerPaymentId: session.payment_intent ?? null, note: null };
  }
  return { paid: false, final: false };
}

/**
 * Checks a payment with its provider and, when paid, confirms the booking in the same transaction.
 * Safe to call any number of times: only the first call that sees it paid changes anything. A payment that
 * lands after the booking ended (expired, cancelled) or on an already-paid booking is refunded in full.
 */
export async function settleOnlinePayment(
  paymentId: string,
  now = new Date(),
): Promise<"paid" | "pending" | "failed"> {
  const payment = await money.findOnlinePayment(prisma, paymentId);
  if (!payment) throw notFound("Payment");
  if (payment.status === "PAID" || payment.status === "REFUNDED") return "paid";
  const verdict = await verify(payment);
  if (!verdict.paid) {
    if (verdict.final) await money.markFailed(prisma, payment.id);
    return verdict.final ? "failed" : "pending";
  }

  const outcome = await runInTransaction(async (tx) => {
    const changed = await money.markPaid(tx, payment.id, {
      paidAt: now,
      providerPaymentId: verdict.providerPaymentId,
      note: verdict.note,
    });
    if (!changed) return null;
    const others = await money.countOtherPaidOnline(tx, payment);
    const current = await money.findPaidFor(tx, payment);
    const confirm = current.status === "AWAITING_PAYMENT" && others === 0;
    if (confirm) {
      if (payment.bookingId) {
        await bookings.changeStatus(tx, payment.businessId, current.id, {
          status: "CONFIRMED",
          holdExpiresAt: null,
        });
      } else {
        await offerings.changeSessionBookingStatus(tx, payment.businessId, current.id, {
          status: "CONFIRMED",
          holdExpiresAt: null,
        });
      }
    }
    await logActivity(tx, {
      userId: null,
      businessId: payment.businessId,
      action: confirm ? "payment.online_confirmed" : "payment.online_late",
      entity: payment.bookingId ? "booking" : "session_booking",
      entityId: current.id,
    });
    return {
      confirm,
      bookingId: current.id,
      kind: payment.bookingId ? ("stay" as const) : ("session" as const),
    };
  });
  if (!outcome) return "paid";

  notifyOnlinePayment(outcome.bookingId, payment.amountCents, payment.id, outcome.kind);
  if (outcome.confirm) {
    notifyBookingStatus(outcome.bookingId, outcome.kind);
  } else {
    await refundPayment(payment.id, "Paid after the booking had ended or was already paid");
  }
  return "paid";
}

/** When the guest comes back from Whish or Stripe, their pending payments are checked at once. */
export async function refreshGuestPayments(token: string): Promise<void> {
  const booking = await findPayableByToken(token);
  if (!booking) return;
  const pending = await money.listPendingOnline(prisma, booking.payable);
  await Promise.all(
    pending.map((payment) =>
      settleOnlinePayment(payment.id).catch((error: unknown) =>
        console.error("[payments] check failed", error),
      ),
    ),
  );
}

/** Scheduled: re-checks payments still pending after a few minutes, in case a callback never arrived. */
export async function reconcilePendingPayments(now = new Date()) {
  const stale = await money.listStalePending(prisma, new Date(now.getTime() - 2 * 60_000), 25);
  let paid = 0;
  for (const payment of stale) {
    const result = await settleOnlinePayment(payment.id, now).catch((error: unknown) => {
      console.error("[payments] reconcile failed", error);
      return "pending";
    });
    if (result === "paid") paid += 1;
  }
  return { checked: stale.length, paid };
}

// ---------- Refunds ----------

interface PlannedRefund {
  refundId: string;
  payment: Payment;
  amountCents: number;
  automatic: boolean;
}

/** Card refunds go through Stripe for any amount; Whish only refunds a whole payment. Others are sent by hand. */
function canRefundAutomatically(payment: Payment, amountCents: number): boolean {
  if (payment.method === "STRIPE") return Boolean(payment.providerPaymentId);
  if (payment.method === "WHISH") return payment.refundedCents === 0 && amountCents === payment.amountCents;
  return false;
}

async function sendRefunds(planned: PlannedRefund[], reason: string) {
  for (const refund of planned.filter((item) => item.automatic)) {
    try {
      if (refund.payment.method === "STRIPE") {
        const result = await createStripeRefund(refund.payment.providerPaymentId!, refund.amountCents);
        await money.setRefundProviderRef(prisma, refund.refundId, result.id);
      } else {
        await refundWhishPayment(refund.payment.id, refund.payment.currency, reason);
        await money.setRefundProviderRef(prisma, refund.refundId, `whish:${refund.payment.id}`);
      }
    } catch (error) {
      // The guest is still owed it: it shows on the admin page to send by hand.
      console.error("[payments] automatic refund failed", error);
      await money.markRefundManual(prisma, refund.refundId);
    }
  }
}

/** Refunds one whole payment (a late or double payment). */
async function refundPayment(paymentId: string, reason: string) {
  const planned = await runInTransaction(async (tx) => {
    const payment = await money.findPaymentForRefund(tx, paymentId);
    const left = payment.amountCents - payment.refundedCents;
    if (left <= 0) return [];
    const automatic = canRefundAutomatically(payment, left);
    const refund = await money.recordRefund(tx, {
      businessId: payment.businessId,
      paymentId,
      amountCents: left,
      currency: payment.currency,
      reason,
      automatic,
    });
    return [{ refundId: refund.id, payment, amountCents: left, automatic }];
  });
  await sendRefunds(planned, reason);
  const payment = planned[0]?.payment;
  if (payment) {
    notifyRefund(
      payment.bookingId ?? payment.sessionBookingId!,
      planned[0]!.amountCents,
      payment.bookingId ? "stay" : "session",
    );
  }
}

/**
 * After a booking ends (cancelled, declined), gives back what the guest paid online: everything when the host
 * or Mabeet ended it, the policy's share when the guest cancelled. Returns the amount refunded.
 */
export async function refundForEndedBooking(
  booking: { kind: "stay" | "session"; id: string; refundPolicy: RefundPolicy; startsAt: Date },
  by: CancelledBy,
  reason: string,
  now = new Date(),
): Promise<number> {
  const payable: Payable =
    booking.kind === "stay"
      ? { kind: "stay", bookingId: booking.id }
      : { kind: "session", sessionBookingId: booking.id };
  const planned = await runInTransaction(async (tx) => {
    const paid = await money.lockPaidOnline(tx, payable);
    const net = paid.reduce((sum, payment) => sum + payment.amountCents - payment.refundedCents, 0);
    let remaining = refundCents({
      paidCents: net,
      policy: booking.refundPolicy,
      by,
      startsAt: booking.startsAt,
      now,
    });
    const list: PlannedRefund[] = [];
    for (const payment of paid) {
      const amount = Math.min(remaining, payment.amountCents - payment.refundedCents);
      if (amount <= 0) continue;
      const automatic = canRefundAutomatically(payment, amount);
      const refund = await money.recordRefund(tx, {
        businessId: payment.businessId,
        paymentId: payment.id,
        amountCents: amount,
        currency: payment.currency,
        reason,
        automatic,
      });
      list.push({ refundId: refund.id, payment, amountCents: amount, automatic });
      remaining -= amount;
    }
    return list;
  });
  await sendRefunds(planned, reason);
  const total = planned.reduce((sum, item) => sum + item.amountCents, 0);
  if (total > 0) notifyRefund(booking.id, total, booking.kind);
  return total;
}
