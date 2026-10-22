import { randomBytes } from "node:crypto";
import { isUniqueViolation, prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { notFound } from "@/server/errors";
import * as simulator from "@/server/repositories/whish-simulator-repository";

// A stand-in for Whish Pay while Mabeet has no Whish keys (WHISH_MODE=simulator). It speaks the same API as
// Whish (v1.4.4), so the real client in src/server/payments/whish.ts runs unchanged against it, and it follows
// Whish's sandbox rules: test phone 96170123456 and code 111111 pay; any other code is a failed attempt that
// leaves the link payable. Swap WHISH_MODE to "sandbox" once Whish issues keys.

const TEST_PHONE = "96170123456";
const TEST_OTP = "111111";

/** Whish's response envelope. */
type Envelope = {
  status: boolean;
  code: string | null;
  dialog: null;
  actions: null;
  extra: null;
  data: unknown;
  retrieved?: boolean;
};
const ok = (data: unknown, retrieved?: boolean): Envelope => ({
  status: true,
  code: null,
  dialog: null,
  actions: null,
  extra: null,
  data,
  ...(retrieved === undefined ? {} : { retrieved }),
});
const fail = (code: string): Envelope => ({
  status: false,
  code,
  dialog: null,
  actions: null,
  extra: null,
  data: null,
});

function simulatorOn(): boolean {
  return env.WHISH_MODE === "simulator";
}

function assertOn(): void {
  if (!simulatorOn()) throw notFound("Page");
}

/** Whish rejects requests without its headers; the simulator does too. */
export function hasWhishHeaders(headers: Headers): boolean {
  return Boolean(headers.get("channel") && headers.get("secret") && headers.get("websiteUrl"));
}

export interface CreateBody {
  amount: string;
  currency: string;
  invoice?: string;
  externalId: string;
  successCallbackUrl: string;
  failureCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}

/** POST /payment/whish. Re-sending an externalId replays the first answer, as Whish does. */
export async function createPayment(body: CreateBody): Promise<Envelope> {
  assertOn();
  if (!["USD", "LBP"].includes(body.currency)) return fail("currency.not_supported");
  const existing = await simulator.findSimulatedPayment(prisma, body.externalId);
  if (existing) return ok({ collectUrl: payPageUrl(existing.code) }, true);
  const code = randomBytes(6).toString("base64url");
  try {
    await simulator.createSimulatedPayment(prisma, {
      externalId: body.externalId,
      code,
      amount: body.amount,
      currency: body.currency,
      invoice: body.invoice ?? null,
      successCallbackUrl: body.successCallbackUrl,
      failureCallbackUrl: body.failureCallbackUrl,
      successRedirectUrl: body.successRedirectUrl,
      failureRedirectUrl: body.failureRedirectUrl,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return createPayment(body);
    throw error;
  }
  return ok({ collectUrl: payPageUrl(code) });
}

const payPageUrl = (code: string) => new URL(`/whish-simulator/pay/${code}`, env.BETTER_AUTH_URL).toString();

/** POST /payment/collect/status */
export async function collectStatus(externalId: string): Promise<Envelope> {
  assertOn();
  const payment = await simulator.findSimulatedPayment(prisma, externalId);
  if (!payment) return fail("external_id.not_exists");
  return ok({ collectStatus: payment.status, payerPhoneNumber: payment.payerPhone });
}

/** POST /payment/whish/refund: only a successful payment, and only once (a repeat is "retrieved"). */
export async function refund(externalId: string): Promise<Envelope> {
  assertOn();
  const payment = await simulator.findSimulatedPayment(prisma, externalId);
  if (!payment) return fail("external_id.not_exists");
  if (payment.status === "refunded") return ok(null, true);
  if (!(await simulator.moveSimulatedPayment(prisma, externalId, "success", { status: "refunded" }))) {
    return fail("fail");
  }
  return ok(null, false);
}

/** The payment page's view of a payment. */
export async function getPayPage(code: string) {
  assertOn();
  const payment = await simulator.findSimulatedPaymentByCode(prisma, code);
  if (!payment) throw notFound("Payment");
  return {
    amount: payment.amount,
    currency: payment.currency,
    invoice: payment.invoice,
    status: payment.status,
    cancelUrl: payment.failureRedirectUrl,
  };
}

/** Calls the merchant's callback by GET, as Whish does. Errors are logged: Whish doesn't retry either. */
async function callBack(url: string) {
  await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((error: unknown) =>
    console.error("[whish-simulator] callback failed", error),
  );
}

/**
 * The payer confirms on the payment page. The right phone and code pay it: the status becomes success and the
 * success callback fires. A wrong code fires the failure callback and leaves the link payable.
 */
export async function pay(code: string, phone: string, otp: string) {
  assertOn();
  const payment = await simulator.findSimulatedPaymentByCode(prisma, code);
  if (!payment) throw notFound("Payment");
  if (payment.status !== "pending")
    return { ok: payment.status === "success", redirect: payment.successRedirectUrl };
  const digits = phone.replace(/\D/g, "");
  if (digits !== TEST_PHONE || otp !== TEST_OTP) {
    await callBack(payment.failureCallbackUrl);
    return { ok: false, redirect: null };
  }
  await simulator.moveSimulatedPayment(prisma, payment.externalId, "pending", {
    status: "success",
    payerPhone: digits,
  });
  await callBack(payment.successCallbackUrl);
  return { ok: true, redirect: payment.successRedirectUrl };
}
