import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, todayUtc } from "@/lib/dates";
import {
  requestBooking,
  cancelStayAsGuest,
  confirmBooking,
  expireAllStaleHolds,
} from "@/server/services/booking-service";
import { settleOnlinePayment, startBookingCheckout } from "@/server/services/online-payment-service";
import { getPayouts, requestPayout } from "@/server/services/payout-service";
import { createPlace, guestRequest, memberWith, prisma, resetDatabase } from "./helpers";

// Whish, as Mabeet sees it: payments it was asked to collect, their status, and refunds. Each test decides
// whether the guest "paid" by setting the status, exactly as Whish's own status endpoint would report it.
const whish = vi.hoisted(() => ({
  status: new Map<string, string>(),
  refunds: [] as string[],
}));

vi.mock("@/server/payments/whish", () => ({
  whishEnabled: () => true,
  supportsWhish: (currency: string) => currency === "USD" || currency === "LBP",
  createWhishPayment: async ({ externalId }: { externalId: string }) => {
    whish.status.set(externalId, "pending");
    return `https://whish.test/pay/${externalId}`;
  },
  getWhishStatus: async (externalId: string) => ({
    status: whish.status.get(externalId) ?? "unknown",
    payerPhone: "96170123456",
  }),
  refundWhishPayment: async (externalId: string) => {
    whish.refunds.push(externalId);
    whish.status.set(externalId, "refunded");
  },
}));

type Terms = Partial<{
  bookingMode: "REQUEST" | "INSTANT";
  paymentCollection: "AT_PLACE" | "ONLINE";
  onlineAmount: "DEPOSIT" | "FULL";
  refundPolicy: "FLEXIBLE" | "MODERATE" | "STRICT" | "NON_REFUNDABLE";
}>;

async function placeWith(terms: Terms, name?: string) {
  const place = await createPlace(name);
  await prisma.business.update({ where: { id: place.business.id }, data: terms });
  return place;
}

/** The guest opens Whish and pays; returns the payment id. */
async function payWithWhish(token: string) {
  const url = await startBookingCheckout(token, "WHISH");
  const paymentId = url.split("/").pop()!;
  whish.status.set(paymentId, "success");
  return paymentId;
}

describe("instant booking and online payment", () => {
  beforeEach(async () => {
    await resetDatabase();
    whish.status.clear();
    whish.refunds.length = 0;
  });

  it("confirms an instant booking paid at the place straight away", async () => {
    const { business, room } = await placeWith({ bookingMode: "INSTANT" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    expect(booking).toMatchObject({ status: "CONFIRMED", onlineDueCents: null, holdExpiresAt: null });
  });

  it("holds an instant online booking for 30 minutes and confirms it only once Whish says it's paid", async () => {
    const { business, room } = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    expect(booking.status).toBe("AWAITING_PAYMENT");
    expect(booking.onlineDueCents).toBe(booking.depositCents);

    const url = await startBookingCheckout(booking.publicToken, "WHISH");
    const paymentId = url.split("/").pop()!;
    // A callback arrives but Whish still says pending (e.g. a wrong OTP): nothing changes.
    expect(await settleOnlinePayment(paymentId)).toBe("pending");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      "AWAITING_PAYMENT",
    );

    whish.status.set(paymentId, "success");
    expect(await settleOnlinePayment(paymentId)).toBe("paid");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
  });

  it("settles a payment once, even when its callbacks arrive together", async () => {
    const { business, room } = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    const paymentId = await payWithWhish(booking.publicToken);

    const results = await Promise.all(Array.from({ length: 10 }, () => settleOnlinePayment(paymentId)));
    expect(results.every((result) => result === "paid")).toBe(true);
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PAID" } })).toBe(1);
    expect(await prisma.activityLog.count({ where: { action: "payment.online_confirmed" } })).toBe(1);
  });

  it("asks for payment only after the host accepts a request, and charges the full amount when set", async () => {
    const { business, room, ctx } = await placeWith({ paymentCollection: "ONLINE", onlineAmount: "FULL" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    expect(booking.status).toBe("HELD");
    await expect(startBookingCheckout(booking.publicToken, "WHISH")).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const accepted = await confirmBooking(ctx, { bookingId: booking.id });
    expect(accepted.status).toBe("AWAITING_PAYMENT");
    const paymentId = await payWithWhish(booking.publicToken);
    await settleOnlinePayment(paymentId);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.amountCents).toBe(booking.totalCents);
  });

  it("frees the nights of an instant booking nobody paid for", async () => {
    const { business, room } = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    await expireAllStaleHolds(new Date(Date.now() + 31 * 60_000));
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");
    await expect(requestBooking(guestRequest(business.slug, room.id, 20, 2))).resolves.toBeDefined();
  });

  it("refunds a payment that lands after the booking expired, in full and automatically", async () => {
    const { business, room } = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    const paymentId = await payWithWhish(booking.publicToken);
    await expireAllStaleHolds(new Date(Date.now() + 31 * 60_000));

    await settleOnlinePayment(paymentId);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment).toMatchObject({ status: "REFUNDED", refundedCents: payment.amountCents });
    expect(whish.refunds).toEqual([paymentId]);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");
  });

  it("refunds by the host's policy when the guest cancels; a partial Whish refund is left for an admin", async () => {
    const { business, room } = await placeWith({
      bookingMode: "INSTANT",
      paymentCollection: "ONLINE",
      refundPolicy: "MODERATE",
    });
    // Three days ahead: MODERATE gives half back.
    const booking = await requestBooking(guestRequest(business.slug, room.id, 3, 2));
    const paymentId = await payWithWhish(booking.publicToken);
    await settleOnlinePayment(paymentId);

    await cancelStayAsGuest(booking.publicToken, "Plans changed");
    const refund = await prisma.refund.findFirstOrThrow({ where: { paymentId } });
    expect(refund.amountCents).toBe(Math.round(booking.depositCents / 2));
    expect(refund.status).toBe("PENDING");
    expect(whish.refunds).toEqual([]);
  });

  it("gives everything back automatically when the host cancels a paid booking", async () => {
    const { business, room, ctx } = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(business.slug, room.id, 20, 2));
    const paymentId = await payWithWhish(booking.publicToken);
    await settleOnlinePayment(paymentId);

    const { cancelBooking } = await import("@/server/services/booking-service");
    await cancelBooking(ctx, { bookingId: booking.id, reason: "Burst pipe" });
    expect(await prisma.refund.findFirstOrThrow({ where: { paymentId } })).toMatchObject({
      status: "DONE",
      amountCents: booking.depositCents,
    });
    expect(whish.refunds).toEqual([paymentId]);
  });
});

describe("payouts", () => {
  beforeEach(resetDatabase);

  /** A paid online booking whose stay has started, so its money is available to pay out. */
  async function earned(place: Awaited<ReturnType<typeof createPlace>>, cents: number) {
    const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 40, 2));
    const checkIn = addDays(todayUtc(), -1);
    await prisma.occupancy.updateMany({ where: { bookingId: booking.id }, data: { active: false } });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", checkIn, checkOut: addDays(checkIn, 2) },
    });
    await prisma.payment.create({
      data: {
        businessId: place.business.id,
        bookingId: booking.id,
        amountCents: cents,
        currency: "USD",
        method: "WHISH",
        status: "PAID",
        online: true,
        paidAt: new Date(),
      },
    });
  }

  const whishPayout = (amountCents: number) => ({
    amountCents,
    currency: "USD" as const,
    method: "WHISH" as const,
    accountName: "Beit Test",
    whishPhone: "+96170123456",
  });

  it("never lets payout requests sent at once add up to more than is available", async () => {
    const place = await createPlace();
    await earned(place, 10_000);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => requestPayout(place.ctx, whishPayout(6_000))),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const { balances } = await getPayouts(place.ctx);
    expect(balances[0]).toMatchObject({ earnedCents: 10_000, requestedCents: 6_000, availableCents: 4_000 });
  });

  it("keeps money for stays that haven't started out of reach", async () => {
    const place = await placeWith({ bookingMode: "INSTANT", paymentCollection: "ONLINE" });
    const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 20, 2));
    whish.status.clear();
    await settleOnlinePayment(await payWithWhish(booking.publicToken));

    const { balances } = await getPayouts(place.ctx);
    expect(balances[0]).toMatchObject({ upcomingCents: booking.depositCents, availableCents: 0 });
    await expect(requestPayout(place.ctx, whishPayout(100))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("shows each business only its own money, and only to owners", async () => {
    const a = await createPlace("Beit A");
    const b = await createPlace("Beit B");
    await earned(a, 10_000);

    expect((await getPayouts(b.ctx)).balances).toEqual([]);
    await expect(requestPayout(b.ctx, whishPayout(1_000))).rejects.toMatchObject({ code: "CONFLICT" });
    const staff = await memberWith(a.business.id, ["settings.manage", "bookings.read"]);
    await expect(getPayouts(staff)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is backed by the database: no refund beyond the payment, no payout without a destination", async () => {
    const place = await createPlace();
    await earned(place, 5_000);
    const payment = await prisma.payment.findFirstOrThrow({ where: { businessId: place.business.id } });
    await expect(
      prisma.payment.update({ where: { id: payment.id }, data: { refundedCents: 5_001 } }),
    ).rejects.toThrow(/payment_refund_within_amount/);
    await expect(
      prisma.payout.create({
        data: {
          businessId: place.business.id,
          amountCents: 1_000,
          currency: "USD",
          method: "BANK_TRANSFER",
          accountName: "Beit Test",
          requestedById: place.owner.id,
        },
      }),
    ).rejects.toThrow(/payout_has_destination/);
  });
});
