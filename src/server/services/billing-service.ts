import type { Plan } from "@prisma/client";
import { PLAN_LIMITS, type PlanLimits } from "@/config/plans";
import {
  createCheckoutSession,
  createPortalSession,
  type StripeEvent,
  stripeEnabled,
  stripeEvent,
  verifyWebhookSignature,
} from "@/server/billing/stripe";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isUniqueViolation, prisma, runInTransaction } from "@/server/db/client";
import { env } from "@/server/env";
import { conflict, forbidden, invalid, notFound, unavailable } from "@/server/errors";
import * as billing from "@/server/repositories/billing-repository";
import { recordAction } from "./audit";

// Host plans: what each allows, upgrading through Stripe Checkout, and Stripe's webhooks keeping the plan true.

type Counted = "rooms" | "offerings" | "members";

const LIMIT_MESSAGES: Record<Counted, (max: number) => string> = {
  rooms: (max) => `Your plan allows up to ${max} rooms. Upgrade to add more.`,
  offerings: (max) => `Your plan allows up to ${max} experiences or services. Upgrade to add more.`,
  members: (max) => `Your plan allows up to ${max} team members. Upgrade to add more.`,
};

async function loadBilling(businessId: string) {
  const row = await billing.findBilling(prisma, businessId);
  if (!row) throw notFound("Business");
  return row;
}

/** Refuses adding one more room, experience or member past the plan's limit. */
export async function assertPlanAllowsAnother(businessId: string, what: Counted): Promise<void> {
  const row = await loadBilling(businessId);
  const max = PLAN_LIMITS[row.plan][what];
  const used = what === "members" ? row._count.memberships : row._count[what];
  if (max !== null && used >= max) throw conflict(LIMIT_MESSAGES[what](max));
}

/** The team assistant and the host MCP server are on Pro and Business. */
export async function assertPlanAllowsAi(businessId: string): Promise<void> {
  const { plan } = await loadBilling(businessId);
  if (!PLAN_LIMITS[plan].ai)
    throw forbidden("The AI assistant is on the Pro and Business plans. Upgrade to use it.");
}

/** For the billing page: the plan, what is used against it, and whether checkout can run. */
export async function getBilling(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  const row = await loadBilling(ctx.businessId);
  const limits: PlanLimits = PLAN_LIMITS[row.plan];
  return {
    plan: row.plan,
    limits,
    usage: { rooms: row._count.rooms, offerings: row._count.offerings, members: row._count.memberships },
    renewsAt: row.planRenewsAt,
    hasSubscription: Boolean(row.stripeSubscriptionId),
    checkoutEnabled: stripeEnabled() && Boolean(env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_BUSINESS),
    canManage: ctx.isOwner,
  };
}

const priceFor = (plan: "PRO" | "BUSINESS") =>
  plan === "PRO" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BUSINESS;

function planForPrice(priceId: string | undefined): Plan | null {
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return null;
}

const dashboardUrl = (businessId: string, query = "") =>
  new URL(`/dashboard/${businessId}/billing${query}`, env.BETTER_AUTH_URL).toString();

/** Only owners spend the business's money. Returns the Stripe Checkout page to send them to. */
export async function startCheckout(ctx: TenantContext, plan: "PRO" | "BUSINESS") {
  if (!ctx.isOwner) throw forbidden("Only an owner can change the plan");
  const priceId = priceFor(plan);
  if (!stripeEnabled() || !priceId) throw unavailable("Payments are not set up yet.");
  const row = await loadBilling(ctx.businessId);
  // A paying business changes plan in the billing portal, so it never ends up with two subscriptions.
  if (row.stripeSubscriptionId) throw conflict("You already have a plan. Change it from Manage billing.");
  const session = await createCheckoutSession({
    priceId,
    businessId: ctx.businessId,
    customerId: row.stripeCustomerId,
    email: (await billing.findUserEmail(prisma, ctx.userId)) ?? "",
    successUrl: dashboardUrl(ctx.businessId, "?checkout=done"),
    cancelUrl: dashboardUrl(ctx.businessId),
  });
  await recordAction(ctx, "billing.checkout_started", "business", ctx.businessId);
  return session.url;
}

/** Stripe's billing portal: change plan, update the card, see invoices, cancel. */
export async function openBillingPortal(ctx: TenantContext) {
  if (!ctx.isOwner) throw forbidden("Only an owner can change the plan");
  const row = await loadBilling(ctx.businessId);
  if (!row.stripeCustomerId) throw invalid("Choose a plan first");
  return (await createPortalSession(row.stripeCustomerId, dashboardUrl(ctx.businessId))).url;
}

/** Statuses in which the business keeps what it pays for. past_due gives the card a chance to be fixed. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

type Tx = Parameters<Parameters<typeof runInTransaction>[0]>[0];

async function applyEvent(tx: Tx, event: StripeEvent): Promise<void> {
  const object = event.data.object;
  const metaBusiness = object.metadata?.businessId;

  if (event.type === "checkout.session.completed") {
    const businessId = object.client_reference_id ?? metaBusiness;
    if (!businessId) return;
    await billing.setBilling(tx, businessId, {
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.subscription ?? null,
    });
    return;
  }

  if (!event.type.startsWith("customer.subscription.")) return;
  const byCustomer = object.customer ? await billing.findBusinessIdByCustomer(tx, object.customer) : null;
  const businessId = metaBusiness ?? byCustomer?.id;
  if (!businessId) return;

  if (event.type === "customer.subscription.deleted") {
    // Only the subscription the business is on can end it; an old one finishing later changes nothing.
    const current =
      byCustomer?.stripeSubscriptionId ?? (await billing.findBilling(tx, businessId))?.stripeSubscriptionId;
    if (current && current !== object.id) return;
    await billing.setBilling(tx, businessId, {
      plan: "FREE",
      stripeSubscriptionId: null,
      planRenewsAt: null,
    });
    return;
  }

  const item = object.items?.data[0];
  const plan = planForPrice(item?.price.id);
  const paid = object.status !== undefined && PAID_STATUSES.has(object.status);
  const periodEnd = object.cancel_at ?? object.current_period_end ?? item?.current_period_end;
  await billing.setBilling(tx, businessId, {
    plan: paid && plan ? plan : "FREE",
    stripeCustomerId: object.customer ?? undefined,
    stripeSubscriptionId: object.id,
    planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

export type WebhookResult = "applied" | "duplicate" | "rejected";

/**
 * Stripe's webhook. The signature proves Stripe sent it; the event id, stored in the same transaction that
 * applies it, makes a retried or replayed event a no-op. If applying fails, nothing is stored and Stripe retries.
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !verifyWebhookSignature(rawBody, signature, secret)) return "rejected";
  const parsed = stripeEvent.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return "rejected";
  const event = parsed.data;
  try {
    await runInTransaction(async (tx) => {
      await billing.recordWebhookEvent(tx, {
        provider: "stripe",
        eventId: event.id,
        payload: { type: event.type, object: event.data.object.id },
      });
      await applyEvent(tx, event);
    });
    return "applied";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}
