import type { PaymentMethod } from "@prisma/client";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { conflict, notFound } from "@/server/errors";
import { findBooking } from "@/server/repositories/booking-repository";
import { findSessionBooking } from "@/server/repositories/offering-repository";
import * as payments from "@/server/repositories/payment-repository";
import { recordAction } from "./audit";
import { notifyPaymentRecorded } from "./notification-service";

export interface DepositInput {
  bookingId: string;
  amountCents: number;
  method: PaymentMethod;
  note: string | null;
}

/**
 * Money moves person to person (Whish, OMT, bank, cash); the app records it.
 * Online providers will end in this same call from their webhook.
 */
export async function recordPayment(ctx: TenantContext, input: DepositInput) {
  requirePermission(ctx, "payments.record");
  const booking = await findBooking(prisma, ctx.businessId, input.bookingId);
  if (!booking) throw notFound("Booking");
  if (booking.status !== "HELD" && booking.status !== "CONFIRMED") {
    throw conflict("Payments can only be recorded on held or confirmed bookings");
  }
  const payment = await payments.createPayment(prisma, {
    ...input,
    businessId: ctx.businessId,
    currency: booking.currency,
    recordedById: ctx.userId,
  });
  await recordAction(ctx, "payment.recorded", "booking", booking.id);
  notifyPaymentRecorded(booking.id, payment.amountCents, payment.id);
  return payment;
}

export function listPayments(ctx: TenantContext, bookingId: string) {
  requirePermission(ctx, "bookings.read");
  return payments.listBookingPayments(prisma, ctx.businessId, bookingId);
}

/** The same deposit record for seats in an experience or service session. */
export async function recordSessionPayment(ctx: TenantContext, input: DepositInput) {
  requirePermission(ctx, "payments.record");
  const booking = await findSessionBooking(prisma, ctx.businessId, input.bookingId);
  if (!booking) throw notFound("Booking");
  if (booking.status !== "HELD" && booking.status !== "CONFIRMED") {
    throw conflict("Payments can only be recorded on held or confirmed bookings");
  }
  const { bookingId, ...payment } = input;
  const saved = await payments.createPayment(prisma, {
    ...payment,
    sessionBookingId: bookingId,
    businessId: ctx.businessId,
    currency: booking.currency,
    recordedById: ctx.userId,
  });
  await recordAction(ctx, "payment.recorded", "session_booking", booking.id);
  notifyPaymentRecorded(booking.id, saved.amountCents, saved.id, "session");
  return saved;
}
