import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/server/billing/stripe";
import { env } from "@/server/env";
import { assertPlanAllowsAi, handleStripeWebhook } from "@/server/services/billing-service";
import { createRoom } from "@/server/services/room-service";
import { createPlace, prisma, resetDatabase } from "./helpers";

const SECRET = "whsec_test_secret";
const PRO_PRICE = "price_test_pro";

function signed(body: string, secret = SECRET, at = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return `t=${at},v1=${signature}`;
}

const room = (name: string) => ({
  name,
  capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  baseRateCents: 9_000,
  minNights: 1,
  amenities: [],
});

describe("plan limits", () => {
  beforeEach(resetDatabase);

  it("stops a Free place at three rooms and keeps AI for paid plans", async () => {
    const place = await createPlace("Beit Free", "FREE");
    await createRoom(place.ctx, room("Two"));
    await createRoom(place.ctx, room("Three"));
    await expect(createRoom(place.ctx, room("Four"))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(assertPlanAllowsAi(place.business.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await prisma.business.update({ where: { id: place.business.id }, data: { plan: "PRO" } });
    await expect(createRoom(place.ctx, room("Four"))).resolves.toBeDefined();
    await expect(assertPlanAllowsAi(place.business.id)).resolves.toBeUndefined();
  });
});

describe("Stripe webhooks", () => {
  const saved = { secret: env.STRIPE_WEBHOOK_SECRET, pro: env.STRIPE_PRICE_PRO };

  beforeEach(async () => {
    await resetDatabase();
    Object.assign(env, { STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_PRO: PRO_PRICE });
  });
  afterEach(() => {
    Object.assign(env, { STRIPE_WEBHOOK_SECRET: saved.secret, STRIPE_PRICE_PRO: saved.pro });
  });

  it("checks signatures: right secret, untouched body, recent timestamp", () => {
    const body = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(body, signed(body), SECRET)).toBe(true);
    expect(verifyWebhookSignature(body, signed(body, "whsec_other"), SECRET)).toBe(false);
    expect(verifyWebhookSignature('{"id":"evt_2"}', signed(body), SECRET)).toBe(false);
    expect(
      verifyWebhookSignature(body, signed(body, SECRET, Math.floor(Date.now() / 1000) - 3600), SECRET),
    ).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });

  it("moves a business to Pro, ignores a replay, and back to Free when the subscription ends", async () => {
    const place = await createPlace("Beit Paid", "FREE");
    const subscription = (type: string, status: string) =>
      JSON.stringify({
        id: `evt_${type}`,
        type,
        data: {
          object: {
            id: "sub_1",
            customer: "cus_1",
            status,
            metadata: { businessId: place.business.id },
            items: { data: [{ price: { id: PRO_PRICE }, current_period_end: 1_900_000_000 }] },
          },
        },
      });

    const created = subscription("customer.subscription.created", "active");
    expect(await handleStripeWebhook(created, signed(created))).toBe("applied");
    expect(await handleStripeWebhook(created, signed(created))).toBe("duplicate");
    expect(await prisma.business.findUnique({ where: { id: place.business.id } })).toMatchObject({
      plan: "PRO",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });

    const deleted = subscription("customer.subscription.deleted", "canceled");
    expect(await handleStripeWebhook(deleted, signed(deleted))).toBe("applied");
    expect(await prisma.business.findUnique({ where: { id: place.business.id } })).toMatchObject({
      plan: "FREE",
      stripeSubscriptionId: null,
    });
  });

  it("rejects an unsigned event without touching anything", async () => {
    const place = await createPlace("Beit Forged", "FREE");
    const forged = JSON.stringify({
      id: "evt_forged",
      type: "customer.subscription.created",
      data: { object: { id: "sub_x", status: "active", metadata: { businessId: place.business.id } } },
    });
    expect(await handleStripeWebhook(forged, "t=1,v1=bad")).toBe("rejected");
    expect((await prisma.business.findUnique({ where: { id: place.business.id } }))?.plan).toBe("FREE");
    expect(await prisma.webhookEvent.count()).toBe(0);
  });
});
