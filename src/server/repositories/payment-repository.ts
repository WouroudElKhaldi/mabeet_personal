import type { PaymentMethod } from "@prisma/client";
import type { Db } from "@/server/db/client";

export function createPayment(
  db: Db,
  payment: {
    businessId: string;
    /** Exactly one of these: a stay or a session booking. */
    bookingId?: string;
    sessionBookingId?: string;
    amountCents: number;
    currency: string;
    method: PaymentMethod;
    note: string | null;
    recordedById: string;
  },
) {
  return db.payment.create({ data: { ...payment, status: "PAID" } });
}

export function listBookingPayments(db: Db, businessId: string, bookingId: string) {
  return db.payment.findMany({ where: { businessId, bookingId }, orderBy: { createdAt: "asc" } });
}
