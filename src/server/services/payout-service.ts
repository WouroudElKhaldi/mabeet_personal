import type { z } from "zod";
import { requireOwner, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as money from "@/server/repositories/money-repository";
import type { payoutDecisionInput, payoutRequestInput } from "@/server/validation/schemas";
import { type PlatformActor, requireSuperAdmin } from "./admin-service";
import { recordAction } from "./audit";

// Mabeet takes no commission: every cent a guest pays online is the host's. Mabeet holds it until the stay or
// session starts (so a cancellation before then can still be refunded from it), then the host asks for it and
// a platform admin sends it by bank transfer or Whish and marks it paid.

export interface Balance extends money.CurrencyBalance {
  /** What the host can ask for now: earned, minus payouts sent or already requested. */
  availableCents: number;
}

const withAvailable = (row: money.CurrencyBalance): Balance => ({
  ...row,
  availableCents: row.earnedCents - row.paidOutCents - row.requestedCents,
});

/** Only owners see and move the business's money. */
const OWNER_ONLY = "Only an owner can see payouts";

export async function getPayouts(ctx: TenantContext) {
  requireOwner(ctx, OWNER_ONLY);
  const [balances, payouts, payments, last] = await Promise.all([
    money.businessBalances(prisma, ctx.businessId),
    money.listBusinessPayouts(prisma, ctx.businessId),
    money.listOnlinePayments(prisma, ctx.businessId),
    money.findLastPayout(prisma, ctx.businessId),
  ]);
  return {
    balances: balances.map(withAvailable),
    payouts,
    payments,
    lastDetails: last && {
      method: last.method,
      accountName: last.accountName,
      bankName: last.bankName,
      iban: last.iban,
      whishPhone: last.whishPhone,
    },
  };
}

/**
 * Asks Mabeet to send money. The business row is locked while the balance is checked and the request saved,
 * so two requests sent at once can never add up to more than what is available.
 */
export async function requestPayout(ctx: TenantContext, input: z.infer<typeof payoutRequestInput>) {
  requireOwner(ctx, OWNER_ONLY);
  const payout = await runInTransaction(async (tx) => {
    await money.lockBusiness(tx, ctx.businessId);
    const balance = (await money.businessBalances(tx, ctx.businessId)).find(
      (row) => row.currency === input.currency,
    );
    const available = balance ? withAvailable(balance).availableCents : 0;
    if (input.amountCents > available) throw conflict("That is more than is available to pay out.");
    return money.createPayout(tx, {
      businessId: ctx.businessId,
      amountCents: input.amountCents,
      currency: input.currency,
      method: input.method,
      accountName: input.accountName,
      bankName: input.method === "BANK_TRANSFER" ? (input.bankName ?? null) : null,
      iban: input.method === "BANK_TRANSFER" ? (input.iban ?? null) : null,
      whishPhone: input.method === "WHISH" ? (input.whishPhone ?? null) : null,
      requestedById: ctx.userId,
    });
  });
  await recordAction(ctx, "payout.requested", "payout", payout.id);
  return payout;
}

// ---------- Platform admin ----------

/** What Mabeet owes each host, payout requests to send, refunds to send by hand, and what Mabeet earned. */
export async function getPlatformMoney(actor: PlatformActor, now = new Date()) {
  requireSuperAdmin(actor);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [balances, requests, recent, refunds, revenueAll, revenueMonth, byMonth, names] = await Promise.all([
    money.allBalances(prisma),
    money.listPayoutRequests(prisma),
    money.listRecentPayouts(prisma, 20),
    money.listManualRefunds(prisma),
    money.sumPlanRevenue(prisma, {}),
    money.sumPlanRevenue(prisma, { from: monthStart }),
    money.planRevenueByMonth(prisma),
    money.listBusinessNames(prisma),
  ]);
  const nameOf = new Map(names.map((business) => [business.id, business.name]));
  return {
    owed: balances
      .map((row) => ({
        ...withAvailable(row),
        businessId: row.businessId,
        businessName: nameOf.get(row.businessId) ?? "",
      }))
      .filter((row) => row.earnedCents + row.upcomingCents - row.paidOutCents !== 0),
    requests,
    recent,
    refunds,
    revenue: { allTime: revenueAll, thisMonth: revenueMonth, byMonth },
  };
}

async function logPlatform(actor: PlatformActor, businessId: string, action: string, entityId: string) {
  await logActivity(prisma, { userId: actor.id, businessId, action, entity: "payout", entityId });
}

/** The admin sent the money (or refuses the request). Each request is decided once. */
export async function decidePayout(
  actor: PlatformActor,
  payoutId: string,
  input: z.infer<typeof payoutDecisionInput>,
) {
  requireSuperAdmin(actor);
  const payout = await money.findPayout(prisma, payoutId);
  if (!payout) throw notFound("Payout");
  const status = input.action === "paid" ? "PAID" : "REJECTED";
  const changed = await money.decidePayout(prisma, payoutId, {
    status,
    reference: input.reference ?? null,
    adminNote: input.note ?? null,
    decidedById: actor.id,
  });
  if (!changed) throw conflict("This payout was already decided.");
  await logPlatform(actor, payout.businessId, `platform.payout_${status.toLowerCase()}`, payoutId);
}

/** A refund Mabeet had to send by hand (a partial Whish refund, or a provider error) has been sent. */
export async function markRefundSent(actor: PlatformActor, refundId: string, reference: string | null) {
  requireSuperAdmin(actor);
  if (!(await money.markRefundDone(prisma, refundId, actor.id, reference))) {
    throw conflict("This refund is not waiting to be sent.");
  }
}
