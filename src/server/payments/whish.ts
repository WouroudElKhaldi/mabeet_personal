import { z } from "zod";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";

// A small client for Whish Pay (v1.4.4): create a payment, read its status, refund it. Every call answers HTTP
// 200 with an envelope; `status: true` succeeded, `code: "500"` means the outcome is unknown (pending), any
// other code failed. The money goes to Mabeet's Whish account.

const BASE_URLS = {
  sandbox: "https://partner.api.sbx.whish.money/itel-service/api",
  production: "https://api.whish.money/itel-service/api",
} as const;

/** Whish only accepts these. */
const WHISH_CURRENCIES = ["USD", "LBP"] as const;

const TIMEOUT_MS = 20_000;

/** The simulator speaks the same API from inside the app, so this client runs unchanged against it. */
function baseUrl(): string {
  if (env.WHISH_MODE === "simulator") return new URL("/api/whish-simulator", env.BETTER_AUTH_URL).toString();
  return BASE_URLS[env.WHISH_MODE];
}

export function whishEnabled(): boolean {
  return (
    env.WHISH_MODE === "simulator" || Boolean(env.WHISH_CHANNEL && env.WHISH_SECRET && env.WHISH_WEBSITE_URL)
  );
}

export const supportsWhish = (currency: string) => (WHISH_CURRENCIES as readonly string[]).includes(currency);

const envelope = z.object({
  status: z.boolean(),
  code: z.union([z.string(), z.number()]).nullish(),
  data: z.unknown(),
  retrieved: z.boolean().optional(),
});

async function call(path: string, body?: unknown): Promise<unknown> {
  if (!whishEnabled()) throw unavailable("Whish payments are not set up yet.");
  const response = await fetch(`${baseUrl()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      channel: env.WHISH_CHANNEL ?? "simulator",
      secret: env.WHISH_SECRET ?? "simulator",
      websiteUrl: env.WHISH_WEBSITE_URL ?? env.BETTER_AUTH_URL,
      "User-Agent": `Mabeet/1.0 (${env.BETTER_AUTH_URL}; ${env.VAPID_SUBJECT.replace("mailto:", "")})`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = envelope.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw unavailable("Whish did not answer as expected. Please try again shortly.");
  if (!parsed.data.status) {
    console.error("Whish error", path, parsed.data.code);
    throw unavailable("Whish payments are not available right now. Please try again shortly.");
  }
  return parsed.data.data;
}

/** Whish takes the amount as a string: USD with up to 2 decimals, LBP without decimals. */
export function whishAmount(cents: number, currency: string): string {
  return currency === "LBP" ? String(Math.round(cents / 100)) : (cents / 100).toFixed(2);
}

export interface WhishPaymentInput {
  externalId: string;
  amountCents: number;
  currency: string;
  invoice: string;
  /** Whish calls these by GET; it forwards our query parameters unchanged. */
  successCallbackUrl: string;
  failureCallbackUrl: string;
  /** Where the payer's browser goes afterwards. */
  successRedirectUrl: string;
  failureRedirectUrl: string;
}

/** Creates a payment and returns the Whish page to send the payer to. */
export async function createWhishPayment(input: WhishPaymentInput): Promise<string> {
  const data = await call("/payment/whish", {
    amount: whishAmount(input.amountCents, input.currency),
    currency: input.currency,
    invoice: input.invoice,
    externalId: input.externalId,
    successCallbackUrl: input.successCallbackUrl,
    failureCallbackUrl: input.failureCallbackUrl,
    successRedirectUrl: input.successRedirectUrl,
    failureRedirectUrl: input.failureRedirectUrl,
  });
  return z.object({ collectUrl: z.string() }).parse(data).collectUrl;
}

/** pending (still payable), success, failed (expired unpaid), refunded or unknown. Only success and failed are final. */
type WhishCollectStatus = "pending" | "success" | "failed" | "refunded" | "unknown";

/** The truth about a payment. Callbacks are unauthenticated, so this is what decides. */
export async function getWhishStatus(externalId: string, currency: string) {
  const data = await call("/payment/collect/status", { currency, externalId });
  const parsed = z.object({ collectStatus: z.string(), payerPhoneNumber: z.string().nullish() }).parse(data);
  const known = ["pending", "success", "failed", "refunded"];
  return {
    status: (known.includes(parsed.collectStatus) ? parsed.collectStatus : "unknown") as WhishCollectStatus,
    payerPhone: parsed.payerPhoneNumber ?? null,
  };
}

/** Refunds the whole payment. Whish has no partial refunds; Mabeet sends those by hand. */
export async function refundWhishPayment(
  externalId: string,
  currency: string,
  reason: string,
): Promise<void> {
  await call("/payment/whish/refund", { currency, externalId, refundReason: reason });
}
