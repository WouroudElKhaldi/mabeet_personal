import type { PaymentMethod, Plan, PlanRequestStatus, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// Paying Mabeet for a plan by hand: the ways to pay that the super admin publishes, and hosts' requests with
// their receipts. The receipt bytes are only read by `findReceipt`, never in lists.

const optionFields = {
  id: true,
  method: true,
  label: true,
  details: true,
  active: true,
  position: true,
} as const;

export function listPaymentOptions(db: Db, onlyActive: boolean) {
  return db.platformPaymentOption.findMany({
    where: onlyActive ? { active: true } : {},
    select: optionFields,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export function findPaymentOption(db: Db, id: string) {
  return db.platformPaymentOption.findUnique({ where: { id }, select: optionFields });
}

export function createPaymentOption(
  db: Db,
  data: { method: PaymentMethod; label: string; details: string; active: boolean; position: number },
) {
  return db.platformPaymentOption.create({ data, select: optionFields });
}

export async function updatePaymentOption(
  db: Db,
  id: string,
  data: Partial<{ method: PaymentMethod; label: string; details: string; active: boolean; position: number }>,
): Promise<boolean> {
  const { count } = await db.platformPaymentOption.updateMany({ where: { id }, data });
  return count === 1;
}

export async function deletePaymentOption(db: Db, id: string): Promise<boolean> {
  const { count } = await db.platformPaymentOption.deleteMany({ where: { id } });
  return count === 1;
}

const requestFields = {
  id: true,
  businessId: true,
  plan: true,
  months: true,
  amountCents: true,
  currency: true,
  method: true,
  payerReference: true,
  note: true,
  receiptMime: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  requestedBy: { select: { name: true, email: true } },
} as const;

export function createPlanRequest(
  db: Db,
  data: {
    businessId: string;
    requestedById: string;
    plan: Plan;
    months: number;
    amountCents: number;
    method: PaymentMethod;
    payerReference: string | null;
    note: string | null;
    receiptMime: string;
    receiptBytes: Uint8Array<ArrayBuffer>;
  },
) {
  return db.planRequest.create({ data, select: requestFields });
}

export function listBusinessRequests(db: Db, businessId: string, take = 20) {
  return db.planRequest.findMany({
    where: { businessId },
    select: requestFields,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function listRequests(db: Db, status: PlanRequestStatus | null, take = 100) {
  return db.planRequest.findMany({
    where: status ? { status } : {},
    select: { ...requestFields, business: { select: { id: true, name: true, plan: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
  });
}

export function findRequest(db: Db, id: string) {
  return db.planRequest.findUnique({ where: { id }, select: requestFields });
}

export function findReceipt(db: Db, id: string) {
  return db.planRequest.findUnique({
    where: { id },
    select: { businessId: true, receiptMime: true, receiptBytes: true },
  });
}

/** Moves a waiting request on, once: false when someone already decided or cancelled it. */
export async function closeRequest(
  db: Db | Prisma.TransactionClient,
  id: string,
  data: {
    status: Exclude<PlanRequestStatus, "PENDING">;
    decidedById?: string;
    decidedAt?: Date;
    decisionNote?: string | null;
  },
  businessId?: string,
): Promise<boolean> {
  const { count } = await db.planRequest.updateMany({
    where: { id, status: "PENDING", ...(businessId ? { businessId } : {}) },
    data,
  });
  return count === 1;
}
