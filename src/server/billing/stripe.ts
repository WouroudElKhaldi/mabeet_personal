import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";

// A small Stripe client over its REST API: plan checkout, card payments for bookings, refunds, the billing
// portal, and webhook signatures.
// No SDK, so there is nothing extra to keep up to date.

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 20_000;
/** Stripe's recommended window for webhook timestamps, against replayed events. */
const SIGNATURE_TOLERANCE_S = 300;

export const stripeEnabled = () => Boolean(env.STRIPE_SECRET_KEY);

/** Stripe takes form-encoded bodies with bracketed keys, e.g. line_items[0][price]. */
function formBody(fields: Record<string, string | number | undefined>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) body.set(key, String(value));
  return body.toString();
}

async function post<T extends z.ZodType>(
  path: string,
  fields: Record<string, string | number | undefined> | null,
  schema: T,
) {
  if (!env.STRIPE_SECRET_KEY) throw unavailable("Payments are not set up yet.");
  const response = await fetch(`${API}${path}`, {
    method: fields === null ? "GET" : "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(fields === null ? {} : { "content-type": "application/x-www-form-urlencoded" }),
    },
    body: fields === null ? undefined : formBody(fields),
  });
  if (!response.ok) {
    console.error("Stripe error", response.status, await response.text().catch(() => ""));
    throw unavailable("Payments are not available right now. Please try again shortly.");
  }
  return schema.parse(await response.json()) as z.infer<T>;
}

const urlResult = z.object({ url: z.string() });

export function createCheckoutSession(input: {
  priceId: string;
  businessId: string;
  customerId: string | null;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return post(
    "/checkout/sessions",
    {
      mode: "subscription",
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": 1,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.businessId,
      customer: input.customerId ?? undefined,
      customer_email: input.customerId ? undefined : input.email,
      "metadata[businessId]": input.businessId,
      "subscription_data[metadata][businessId]": input.businessId,
    },
    urlResult,
  );
}

/** Currencies a guest can pay by card. Lebanese pounds go through Whish. */
const CARD_CURRENCIES = ["USD", "EUR"] as const;
export const supportsCard = (currency: string) => (CARD_CURRENCIES as readonly string[]).includes(currency);

const paymentCheckout = z.object({ id: z.string(), url: z.string() });

/** A one-off card payment on Stripe Checkout, into Mabeet's Stripe account. */
export function createPaymentCheckout(input: {
  paymentId: string;
  amountCents: number;
  currency: string;
  description: string;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  return post(
    "/checkout/sessions",
    {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": input.amountCents,
      "line_items[0][price_data][product_data][name]": input.description,
      customer_email: input.email ?? undefined,
      client_reference_id: input.paymentId,
      "metadata[paymentId]": input.paymentId,
      "payment_intent_data[metadata][paymentId]": input.paymentId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    paymentCheckout,
  );
}

const checkoutState = z.object({
  id: z.string(),
  payment_status: z.string(),
  payment_intent: z.string().nullish(),
});

/** Reads a checkout back from Stripe: whether it was paid, and the payment to refund later. */
export function retrieveCheckoutSession(sessionId: string) {
  return post(`/checkout/sessions/${encodeURIComponent(sessionId)}`, null, checkoutState);
}

/** Refunds part or all of a card payment. The idempotency of the call comes from refunding once per Refund row. */
export function createStripeRefund(paymentIntentId: string, amountCents: number) {
  return post(
    "/refunds",
    { payment_intent: paymentIntentId, amount: amountCents },
    z.object({ id: z.string(), status: z.string() }),
  );
}

export function createPortalSession(customerId: string, returnUrl: string) {
  return post("/billing_portal/sessions", { customer: customerId, return_url: returnUrl }, urlResult);
}

/**
 * Checks the Stripe-Signature header: HMAC-SHA256 of "timestamp.body" with the webhook secret, compared in
 * constant time, and a timestamp within five minutes. Returns false for anything that does not match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=") as [string, string | undefined]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** The parts of a Stripe event this app reads. Unknown fields are ignored. */
export const stripeEvent = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z
      .object({
        id: z.string(),
        customer: z.string().nullish(),
        subscription: z.string().nullish(),
        client_reference_id: z.string().nullish(),
        status: z.string().optional(),
        mode: z.string().optional(),
        payment_status: z.string().optional(),
        payment_intent: z.string().nullish(),
        /** Invoices: what the host paid for their plan. */
        amount_paid: z.number().optional(),
        currency: z.string().optional(),
        lines: z
          .object({
            data: z.array(
              z
                .object({
                  pricing: z.object({ price_details: z.object({ price: z.string() }).nullish() }).nullish(),
                  price: z.object({ id: z.string() }).nullish(),
                })
                .loose(),
            ),
          })
          .optional(),
        current_period_end: z.number().optional(),
        cancel_at: z.number().nullish(),
        metadata: z.record(z.string(), z.string()).optional(),
        items: z
          .object({
            data: z.array(
              // Newer API versions put the billing period on each item instead of the subscription.
              z.object({ price: z.object({ id: z.string() }), current_period_end: z.number().optional() }),
            ),
          })
          .optional(),
      })
      .loose(),
  }),
});
export type StripeEvent = z.infer<typeof stripeEvent>;
