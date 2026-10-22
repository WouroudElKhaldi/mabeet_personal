/**
 * The online-payment run against a running app (pnpm payments): instant booking paid through the Whish
 * simulator, refunds, a payout from request to "sent", a plan paid with Whish, the admin's money page, card
 * checkout on Stripe test mode, and the ways it must refuse. It switches one demo place to instant booking with
 * online payment for the run and puts everything back at the end. Needs WHISH_MODE=simulator.
 */
import { BASE, check, db, finish, http, isNotFound, isoIn, send, signIn } from "./lib/e2e";

const GUEST = "Payments E2E";

async function book(slug: string, roomId: string, daysAhead: number) {
  const checkIn = isoIn(daysAhead);
  const checkOut = isoIn(daysAhead + 2);
  return send("POST", `/api/public/places/${slug}/bookings`, {
    roomId,
    checkIn,
    checkOut,
    guestCount: 1,
    guestName: GUEST,
    guestPhone: "+96171000002",
  });
}

/** The guest goes through the simulated Whish page; returns the simulator's answer. */
async function payOnWhish(url: string, otp: string) {
  const code = new URL(url).pathname.split("/").pop()!;
  return send("POST", `/api/whish-simulator/pay/${code}`, { phone: "96170123456", otp });
}

async function main() {
  const host = await signIn("host@mabeet.test");
  const admin = await signIn("admin@mabeet.test");
  const staff = await signIn("staff@mabeet.test");

  const place = await db.business.findFirstOrThrow({
    where: { memberships: { some: { user: { email: "staff@mabeet.test" } } } },
    include: { rooms: { where: { active: true }, take: 1 } },
  });
  const room = place.rooms[0]!;
  const original = {
    bookingMode: place.bookingMode,
    paymentCollection: place.paymentCollection,
    onlineAmount: place.onlineAmount,
    refundPolicy: place.refundPolicy,
    plan: place.plan,
    planRenewsAt: place.planRenewsAt,
  };
  const days = 300 + Math.floor(Math.random() * 150);

  try {
    // ---------- Host turns on instant booking with online payment, from Settings ----------
    const settings = await send(
      "PATCH",
      `/api/workspaces/${place.id}/settings`,
      {
        bookingMode: "INSTANT",
        paymentCollection: "ONLINE",
        onlineAmount: "DEPOSIT",
        refundPolicy: "MODERATE",
      },
      host,
    );
    check(
      "host switches to instant booking, paid online",
      settings.status === 200,
      `status ${settings.status}`,
    );
    const frontDesk = await send(
      "PATCH",
      `/api/workspaces/${place.id}/settings`,
      { bookingMode: "REQUEST" },
      staff,
    );
    check(
      "front desk can't change payment settings (403)",
      frontDesk.status === 403,
      `status ${frontDesk.status}`,
    );

    // ---------- Guest books instantly and pays with Whish ----------
    const booked = await book(place.slug, room.id, days);
    const token = String(booked.body.publicToken);
    check(
      "instant booking waits for payment (201 AWAITING_PAYMENT)",
      booked.status === 201 && booked.body.status === "AWAITING_PAYMENT",
      `status ${booked.status} ${String(booked.body.status)}`,
    );
    const page = await (await http(`/b/${token}`)).text();
    check("booking page offers Whish", page.includes("Pay with Whish"));

    const card = await send("POST", `/api/public/bookings/${token}/checkout`, { method: "CARD" });
    const cardUrl = String(card.body.url ?? "");
    check(
      "card checkout opens Stripe (test mode)",
      card.status === 200 && cardUrl.startsWith("https://checkout.stripe.com/"),
      `status ${card.status} ${cardUrl.slice(0, 40) || JSON.stringify(card.body).slice(0, 80)}`,
    );

    const checkout = await send("POST", `/api/public/bookings/${token}/checkout`, { method: "WHISH" });
    const whishUrl = String(checkout.body.url ?? "");
    check(
      "Whish checkout opens the Whish page",
      checkout.status === 200 && whishUrl.startsWith(BASE),
      whishUrl,
    );
    const whishPage = await (await http(new URL(whishUrl).pathname)).text();
    check(
      "Whish page shows the test phone and code",
      whishPage.includes("96170123456") && whishPage.includes("111111"),
    );

    const wrong = await payOnWhish(whishUrl, "000000");
    const stillWaiting = await db.booking.findUniqueOrThrow({ where: { publicToken: token } });
    check(
      "a wrong Whish code changes nothing",
      wrong.body.ok === false && stillWaiting.status === "AWAITING_PAYMENT",
      String(stillWaiting.status),
    );
    const paid = await payOnWhish(whishUrl, "111111");
    const confirmed = await db.booking.findUniqueOrThrow({
      where: { publicToken: token },
      include: { payments: true },
    });
    check(
      "the right code pays, and Whish's callback confirms the booking",
      paid.body.ok === true && confirmed.status === "CONFIRMED",
      String(confirmed.status),
    );
    check(
      "one paid Whish payment of the deposit is recorded",
      confirmed.payments.filter((payment) => payment.status === "PAID").length === 1 &&
        confirmed.payments.find((payment) => payment.status === "PAID")?.amountCents ===
          confirmed.depositCents,
    );
    const back = await (await http(String(paid.body.redirect).replace(BASE, ""))).text();
    check("back on the booking page, it shows the payment", back.includes("Paid online"));
    const again = await send("POST", `/api/public/bookings/${token}/checkout`, { method: "WHISH" });
    check("a paid booking can't be paid again (409)", again.status === 409, `status ${again.status}`);

    const forged = await http("/api/payments/whish/callback?payment=not-a-real-payment");
    check("a forged Whish callback is refused (404)", forged.status === 404, `status ${forged.status}`);

    // ---------- Host sees the money; payouts only once the stay starts ----------
    const payouts = await http(`/api/workspaces/${place.id}/payouts`, { cookie: host });
    const payoutsBody = (await payouts.json()) as {
      balances: Array<{ upcomingCents: number; availableCents: number }>;
    };
    check(
      "host sees the deposit as upcoming, not yet available",
      payouts.status === 200 && (payoutsBody.balances[0]?.upcomingCents ?? 0) >= confirmed.depositCents,
    );
    const staffPayouts = await http(`/api/workspaces/${place.id}/payouts`, { cookie: staff });
    check("front desk can't see payouts (403)", staffPayouts.status === 403, `status ${staffPayouts.status}`);
    const early = await send(
      "POST",
      `/api/workspaces/${place.id}/payouts`,
      {
        amountCents: 1_000_000_00,
        currency: place.currency,
        method: "WHISH",
        accountName: "Host",
        whishPhone: "+96170123456",
      },
      host,
    );
    check(
      "asking for more than is available is refused (409)",
      early.status === 409,
      `status ${early.status}`,
    );
    const noIban = await send(
      "POST",
      `/api/workspaces/${place.id}/payouts`,
      { amountCents: 1000, currency: place.currency, method: "BANK_TRANSFER", accountName: "Host" },
      host,
    );
    check("a bank payout without an IBAN is refused (400)", noIban.status === 400, `status ${noIban.status}`);

    // The stay "starts": its money becomes available, the host asks for it, the admin sends it.
    const yesterday = new Date(Date.now() - 86_400_000);
    await db.occupancy.updateMany({ where: { bookingId: confirmed.id }, data: { active: false } });
    await db.booking.update({
      where: { id: confirmed.id },
      data: { checkIn: yesterday, checkOut: new Date(Date.now() + 86_400_000) },
    });
    const request = await send(
      "POST",
      `/api/workspaces/${place.id}/payouts`,
      {
        amountCents: confirmed.depositCents,
        currency: place.currency,
        method: "WHISH",
        accountName: "Dar host",
        whishPhone: "+96170123456",
      },
      host,
    );
    check("host asks for the available money (201)", request.status === 201, `status ${request.status}`);
    const payoutId = String((request.body.payout as { id?: string } | undefined)?.id);
    const adminPage = await (await http("/admin/money", { cookie: admin })).text();
    check(
      "admin's money page lists the request",
      adminPage.includes("Payouts to send") && adminPage.includes("+96170123456"),
    );
    check("only admins see the money page", await isNotFound(await http("/admin/money", { cookie: host })));
    const hostDecides = await send("POST", `/api/admin/payouts/${payoutId}`, { action: "paid" }, host);
    check(
      "a host can't mark their own payout sent (403)",
      hostDecides.status === 403,
      `status ${hostDecides.status}`,
    );
    const sent = await send(
      "POST",
      `/api/admin/payouts/${payoutId}`,
      { action: "paid", reference: "WH-123" },
      admin,
    );
    check("admin marks the payout sent", sent.status === 200, `status ${sent.status}`);
    const twice = await send("POST", `/api/admin/payouts/${payoutId}`, { action: "rejected" }, admin);
    check("a payout can't be decided twice (409)", twice.status === 409, `status ${twice.status}`);

    // ---------- Guest cancels a paid booking far ahead: full refund through Whish ----------
    const second = await book(place.slug, room.id, days + 10);
    const secondToken = String(second.body.publicToken);
    const secondCheckout = await send("POST", `/api/public/bookings/${secondToken}/checkout`, {
      method: "WHISH",
    });
    await payOnWhish(String(secondCheckout.body.url), "111111");
    const cancel = await send("POST", `/api/public/bookings/${secondToken}/cancel`, { reason: "E2E" });
    const refunded = await db.booking.findUniqueOrThrow({
      where: { publicToken: secondToken },
      include: { payments: { include: { refunds: true } } },
    });
    const paidPayment = refunded.payments.find((payment) => payment.status === "REFUNDED");
    check(
      "cancelling 10+ days ahead refunds the deposit in full, through Whish",
      cancel.status === 200 && paidPayment?.refunds[0]?.status === "DONE",
      `status ${cancel.status} ${paidPayment?.status ?? "no refund"}`,
    );

    // ---------- Host pays a month of Pro with Whish ----------
    const plan = await send("POST", `/api/workspaces/${place.id}/billing/whish`, { plan: "PRO" }, host);
    check(
      "host starts paying Pro with Whish",
      plan.status === 200,
      `status ${plan.status} ${JSON.stringify(plan.body).slice(0, 80)}`,
    );
    if (plan.status === 200) {
      await payOnWhish(String(plan.body.url), "111111");
      const after = await db.business.findUniqueOrThrow({ where: { id: place.id } });
      const month = (after.planRenewsAt?.getTime() ?? 0) - Date.now();
      check(
        "paying moves the business to Pro for a month",
        after.plan === "PRO" && month > 29 * 86_400_000,
        after.plan,
      );
      const earned = await db.planPayment.count({
        where: { businessId: place.id, status: "PAID", method: "WHISH" },
      });
      check("the plan payment counts as Mabeet's revenue", earned >= 1);
    }
  } finally {
    // Put the demo place back as it was.
    await db.business.update({ where: { id: place.id }, data: original });
    const ids = (await db.booking.findMany({ where: { guestName: GUEST }, select: { id: true } })).map(
      (row) => row.id,
    );
    await db.payout.deleteMany({
      where: { businessId: place.id, accountName: { in: ["Dar host", "Host"] } },
    });
    await db.payment.deleteMany({ where: { bookingId: { in: ids } } });
    await db.booking.deleteMany({ where: { id: { in: ids } } });
    await db.planPayment.deleteMany({ where: { businessId: place.id, method: "WHISH" } });
  }
  await finish();
}

void main();
