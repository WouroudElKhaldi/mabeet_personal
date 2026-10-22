import type { Db } from "@/server/db/client";

// The simulated Whish Pay server's own state. Only used when WHISH_MODE=simulator.

export function createSimulatedPayment(
  db: Db,
  payment: {
    externalId: string;
    code: string;
    amount: string;
    currency: string;
    invoice: string | null;
    successCallbackUrl: string;
    failureCallbackUrl: string;
    successRedirectUrl: string;
    failureRedirectUrl: string;
  },
) {
  return db.whishSandboxPayment.create({ data: payment });
}

export function findSimulatedPayment(db: Db, externalId: string) {
  return db.whishSandboxPayment.findUnique({ where: { externalId } });
}

export function findSimulatedPaymentByCode(db: Db, code: string) {
  return db.whishSandboxPayment.findUnique({ where: { code } });
}

/** Moves a payment between Whish's states, only from the state given. Returns false if it was elsewhere. */
export async function moveSimulatedPayment(
  db: Db,
  externalId: string,
  from: string,
  to: { status: string; payerPhone?: string },
): Promise<boolean> {
  const { count } = await db.whishSandboxPayment.updateMany({
    where: { externalId, status: from },
    data: to,
  });
  return count === 1;
}
