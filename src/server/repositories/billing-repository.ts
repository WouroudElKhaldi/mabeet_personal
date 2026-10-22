import type { Plan, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// A business's plan, its Stripe ids, what it uses against the plan's limits, and processed webhooks.

export function findBilling(db: Db, businessId: string) {
  return db.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planRenewsAt: true,
      _count: {
        select: {
          rooms: true,
          offerings: true,
          memberships: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
}

export function findBusinessIdByCustomer(db: Db, stripeCustomerId: string) {
  return db.business.findUnique({
    where: { stripeCustomerId },
    select: { id: true, stripeSubscriptionId: true },
  });
}

export function setBilling(
  db: Db,
  businessId: string,
  data: {
    plan?: Plan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    planRenewsAt?: Date | null;
  },
) {
  return db.business.update({ where: { id: businessId }, data, select: { id: true } });
}

/** Records a webhook event. Run inside the transaction that applies it: a failure rolls both back. */
export function recordWebhookEvent(
  tx: Prisma.TransactionClient,
  event: { provider: string; eventId: string; payload: Prisma.InputJsonValue },
) {
  return tx.webhookEvent.create({ data: event, select: { id: true } });
}

export async function findUserEmail(db: Db, userId: string): Promise<string | null> {
  return (await db.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? null;
}
