import type { Payment, PaymentMethod, PayoutMethod, Plan } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Money that passes through Mabeet: guests paying online, refunds, payouts to hosts, and hosts paying for plans.
// Every team query filters by businessId; the admin queries are platform-wide on purpose.

export type Payable = { kind: "stay"; bookingId: string } | { kind: "session"; sessionBookingId: string };

const payableWhere = (payable: Payable) =>
  payable.kind === "stay" ? { bookingId: payable.bookingId } : { sessionBookingId: payable.sessionBookingId };

export function createOnlinePayment(
  db: Db,
  input: {
    businessId: string;
    payable: Payable;
    amountCents: number;
    currency: string;
    method: PaymentMethod;
  },
) {
  return db.payment.create({
    data: {
      businessId: input.businessId,
      ...payableWhere(input.payable),
      amountCents: input.amountCents,
      currency: input.currency,
      method: input.method,
      status: "PENDING",
      online: true,
    },
  });
}

export function setCheckout(db: Db, paymentId: string, data: { providerRef: string; checkoutUrl: string }) {
  return db.payment.update({ where: { id: paymentId }, data, select: { id: true } });
}

export function findOnlinePayment(db: Db, paymentId: string) {
  return db.payment.findFirst({ where: { id: paymentId, online: true } });
}

/** Marks a pending payment paid. Returns false when it was already settled, so a repeated callback does nothing. */
export async function markPaid(
  tx: Tx,
  paymentId: string,
  data: { paidAt: Date; providerPaymentId?: string | null; note?: string | null },
): Promise<boolean> {
  const { count } = await tx.payment.updateMany({
    where: { id: paymentId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PAID", ...data },
  });
  return count === 1;
}

/** Other paid online payments of the same booking: a second one means the guest paid twice. */
export function countOtherPaidOnline(tx: Tx, payment: Payment) {
  return tx.payment.count({
    where: {
      id: { not: payment.id },
      online: true,
      status: "PAID",
      ...(payment.bookingId
        ? { bookingId: payment.bookingId }
        : { sessionBookingId: payment.sessionBookingId }),
    },
  });
}

/** The stay or session booking a payment is for, with its current status. */
export async function findPaidFor(tx: Tx, payment: Payment) {
  return payment.bookingId
    ? tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId }, select: { id: true, status: true } })
    : tx.sessionBooking.findUniqueOrThrow({
        where: { id: payment.sessionBookingId ?? "" },
        select: { id: true, status: true },
      });
}

/** A payment, locked while a refund is taken from it. */
export async function findPaymentForRefund(tx: Tx, paymentId: string) {
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
  return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
}

export async function markFailed(db: Db, paymentId: string): Promise<void> {
  await db.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Paid online payments of one booking, locked so two refunds can't both take the same money. */
export async function lockPaidOnline(tx: Tx, payable: Payable) {
  const ids =
    payable.kind === "stay"
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Payment" WHERE "bookingId" = ${payable.bookingId}
            AND online AND status IN ('PAID', 'REFUNDED') FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Payment" WHERE "sessionBookingId" = ${payable.sessionBookingId}
            AND online AND status IN ('PAID', 'REFUNDED') FOR UPDATE`;
  return tx.payment.findMany({ where: { id: { in: ids.map((row) => row.id) } }, orderBy: { paidAt: "asc" } });
}

/** Pending online payments of a booking, to check with the provider when the guest comes back. */
export function listPendingOnline(db: Db, payable: Payable) {
  return db.payment.findMany({ where: { ...payableWhere(payable), online: true, status: "PENDING" } });
}

/** Pending online payments older than a moment, for the scheduled check that catches missed callbacks. */
export function listStalePending(db: Db, olderThan: Date, take: number) {
  return db.payment.findMany({
    where: { online: true, status: "PENDING", providerRef: { not: null }, createdAt: { lt: olderThan } },
    orderBy: { createdAt: "asc" },
    take,
  });
}

export async function recordRefund(
  tx: Tx,
  refund: {
    businessId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
    reason: string;
    automatic: boolean;
  },
) {
  const payment = await tx.payment.update({
    where: { id: refund.paymentId },
    data: { refundedCents: { increment: refund.amountCents } },
  });
  if (payment.refundedCents >= payment.amountCents) {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  }
  return tx.refund.create({
    data: {
      businessId: refund.businessId,
      paymentId: refund.paymentId,
      amountCents: refund.amountCents,
      currency: refund.currency,
      reason: refund.reason,
      status: refund.automatic ? "DONE" : "PENDING",
      doneAt: refund.automatic ? new Date() : null,
    },
  });
}

export function setRefundProviderRef(db: Db, refundId: string, providerRef: string) {
  return db.refund.update({ where: { id: refundId }, data: { providerRef }, select: { id: true } });
}

/** A refund that couldn't go through the provider becomes a manual one for an admin to send. */
export function markRefundManual(db: Db, refundId: string) {
  return db.refund.update({
    where: { id: refundId },
    data: { status: "PENDING", doneAt: null },
    select: { id: true },
  });
}

// ---------- Balances ----------

export interface CurrencyBalance {
  currency: string;
  /** Collected for stays and sessions that have started, net of refunds. */
  earnedCents: number;
  /** Collected for stays and sessions still ahead, net of refunds. Not paid out until they start. */
  upcomingCents: number;
  /** Payouts requested or already sent. */
  paidOutCents: number;
  requestedCents: number;
}

/**
 * What Mabeet holds for one business, per currency. Money for a stay becomes available once the stay has
 * started, so a cancellation before then can still be refunded from it.
 */
export async function businessBalances(db: Db, businessId: string): Promise<CurrencyBalance[]> {
  return (await balances(db, businessId)).map(({ businessId: _, ...balance }) => balance);
}

/** Every business's balances, for the admin's "what I owe" page. */
export function allBalances(db: Db) {
  return balances(db, null);
}

async function balances(db: Db, businessId: string | null) {
  return db.$queryRaw<Array<CurrencyBalance & { businessId: string }>>`WITH collected AS (
       SELECT p."businessId", p.currency,
              SUM(CASE WHEN COALESCE(b."checkIn" <= current_date, s."startsAt" <= now())
                       THEN p."amountCents" - p."refundedCents" ELSE 0 END)::int AS earned,
              SUM(CASE WHEN COALESCE(b."checkIn" <= current_date, s."startsAt" <= now())
                       THEN 0 ELSE p."amountCents" - p."refundedCents" END)::int AS upcoming
       FROM "Payment" p
       LEFT JOIN "Booking" b ON b.id = p."bookingId"
       LEFT JOIN "SessionBooking" sb ON sb.id = p."sessionBookingId"
       LEFT JOIN "OfferingSession" s ON s.id = sb."sessionId"
       WHERE p.online AND p.status IN ('PAID', 'REFUNDED') AND (${businessId}::text IS NULL OR p."businessId" = ${businessId})
       GROUP BY 1, 2
     ), paid_out AS (
       SELECT "businessId", currency,
              SUM(CASE WHEN status = 'PAID' THEN "amountCents" ELSE 0 END)::int AS paid,
              SUM(CASE WHEN status = 'REQUESTED' THEN "amountCents" ELSE 0 END)::int AS requested
       FROM "Payout"
       WHERE status IN ('PAID', 'REQUESTED') AND (${businessId}::text IS NULL OR "businessId" = ${businessId})
       GROUP BY 1, 2
     )
     SELECT COALESCE(c."businessId", o."businessId") AS "businessId",
            COALESCE(c.currency, o.currency) AS currency,
            COALESCE(c.earned, 0) AS "earnedCents",
            COALESCE(c.upcoming, 0) AS "upcomingCents",
            COALESCE(o.paid, 0) AS "paidOutCents",
            COALESCE(o.requested, 0) AS "requestedCents"
     FROM collected c
     FULL JOIN paid_out o ON o."businessId" = c."businessId" AND o.currency = c.currency
     ORDER BY 1, 2`;
}

/** Locks the business row so two payout requests can't both spend the same balance. */
export async function lockBusiness(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
}

// ---------- Payouts ----------

export function createPayout(
  tx: Tx,
  payout: {
    businessId: string;
    amountCents: number;
    currency: string;
    method: PayoutMethod;
    accountName: string;
    bankName: string | null;
    iban: string | null;
    whishPhone: string | null;
    requestedById: string;
  },
) {
  return tx.payout.create({ data: payout });
}

export function listBusinessPayouts(db: Db, businessId: string) {
  return db.payout.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 50 });
}

/** The last details a business used, to fill in the next request. */
export function findLastPayout(db: Db, businessId: string) {
  return db.payout.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" } });
}

export function listOnlinePayments(db: Db, businessId: string) {
  return db.payment.findMany({
    where: { businessId, online: true, status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    take: 50,
    include: {
      booking: { select: { reference: true, guestName: true, checkIn: true } },
      sessionBooking: { select: { reference: true, guestName: true } },
    },
  });
}

export function listPayoutRequests(db: Db) {
  return db.payout.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: { business: { select: { name: true, slug: true } } },
  });
}

export function listRecentPayouts(db: Db, take: number) {
  return db.payout.findMany({
    where: { status: { not: "REQUESTED" } },
    orderBy: { decidedAt: "desc" },
    take,
    include: { business: { select: { name: true } } },
  });
}

/** Settles a requested payout once. Returns false when someone already decided it. */
export async function decidePayout(
  db: Db,
  payoutId: string,
  decision: {
    status: "PAID" | "REJECTED";
    reference: string | null;
    adminNote: string | null;
    decidedById: string;
  },
): Promise<boolean> {
  const { count } = await db.payout.updateMany({
    where: { id: payoutId, status: "REQUESTED" },
    data: { ...decision, decidedAt: new Date() },
  });
  return count === 1;
}

export function findPayout(db: Db, payoutId: string) {
  return db.payout.findUnique({ where: { id: payoutId } });
}

export function listManualRefunds(db: Db) {
  return db.refund.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      business: { select: { name: true } },
      payment: {
        select: {
          method: true,
          booking: { select: { reference: true, guestName: true, guestPhone: true } },
          sessionBooking: { select: { reference: true, guestName: true, guestPhone: true } },
        },
      },
    },
  });
}

export async function markRefundDone(db: Db, refundId: string, adminId: string, reference: string | null) {
  const { count } = await db.refund.updateMany({
    where: { id: refundId, status: "PENDING" },
    data: { status: "DONE", doneAt: new Date(), doneById: adminId, providerRef: reference },
  });
  return count === 1;
}

export function listBusinessNames(db: Db) {
  return db.business.findMany({ select: { id: true, name: true } });
}

// ---------- Plan payments (Mabeet's revenue) ----------

export function createPlanPayment(
  db: Db,
  input: {
    businessId: string;
    plan: Plan;
    amountCents: number;
    currency: string;
    method: PaymentMethod;
    providerRef: string;
    status: "PENDING" | "PAID";
    paidAt?: Date;
  },
) {
  return db.planPayment.create({ data: input });
}

export function findPlanPayment(db: Db, id: string) {
  return db.planPayment.findUnique({ where: { id } });
}

export function setPlanCheckout(db: Db, id: string, checkoutUrl: string) {
  return db.planPayment.update({ where: { id }, data: { checkoutUrl }, select: { id: true } });
}

export async function markPlanPaid(tx: Tx, id: string, paidAt: Date): Promise<boolean> {
  const { count } = await tx.planPayment.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PAID", paidAt },
  });
  return count === 1;
}

export function listStalePlanPayments(db: Db, olderThan: Date, take: number) {
  return db.planPayment.findMany({
    where: { status: "PENDING", method: "WHISH", createdAt: { lt: olderThan } },
    take,
  });
}

export function sumPlanRevenue(db: Db, filter: { businessId?: string; from?: Date }) {
  return db.planPayment.groupBy({
    by: ["currency", "method"],
    where: { status: "PAID", businessId: filter.businessId, paidAt: filter.from && { gte: filter.from } },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
}

export function planRevenueByMonth(db: Db) {
  return db.$queryRaw<Array<{ month: string; cents: number; payments: number }>>`
    SELECT to_char("paidAt", 'YYYY-MM') AS month, SUM("amountCents")::int AS cents, COUNT(*)::int AS payments
    FROM "PlanPayment" WHERE status = 'PAID' AND currency = 'USD'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12`;
}

/** Whish plans are paid month by month; a month that ran out without a new payment goes back to Free. */
export async function expireWhishPlans(db: Db, now: Date): Promise<number> {
  const { count } = await db.business.updateMany({
    where: { plan: { not: "FREE" }, stripeSubscriptionId: null, planRenewsAt: { lt: now } },
    data: { plan: "FREE", planRenewsAt: null },
  });
  return count;
}

export function extendPlan(tx: Tx, businessId: string, plan: Plan, renewsAt: Date) {
  return tx.business.update({
    where: { id: businessId },
    data: { plan, planRenewsAt: renewsAt },
    select: { id: true },
  });
}
