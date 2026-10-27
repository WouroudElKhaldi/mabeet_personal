/**
 * Demo history: about five months of past stays and two months ahead for every demo place, so the calendar,
 * analytics, notifications, reviews, payouts and the admin's money pages have something real to show.
 * Everything is fictional. Deterministic (a seeded random), and skipped when the history is already there.
 */
import type { BookingStatus, PaymentMethod } from "@prisma/client";
import { isActiveBooking } from "../src/config/enums";
import { prisma } from "../src/server/db/client";
import { addDays, todayUtc } from "../src/lib/dates";
import { secureToken } from "../src/lib/tokens";

/** Marks the demo bookings, so the seed knows it already ran and they're easy to spot. */
const REFERENCE_PREFIX = "DEMO";
const PAST_DAYS = 150;
const FUTURE_DAYS = 60;

/** A small seeded random, so every run makes the same history. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const GUESTS = [
  ["Maya Haddad", "+96171234501"],
  ["Karim Khoury", "+96170234502"],
  ["Lea Saade", "+96176234503"],
  ["Rami Nassar", "+96103234504"],
  ["Nour Azar", "+96181234505"],
  ["Elie Gemayel", "+96171234506"],
  ["Sara Mansour", "+33612345607"],
  ["Jad Abou Jaoude", "+96170234508"],
  ["Hiba Fakhoury", "+96176234509"],
  ["Tony Daher", "+14155550110"],
  ["Rita Bou Saab", "+96171234511"],
  ["Omar Itani", "+97150123412"],
] as const;

const REVIEWS = [
  [5, "Felt like staying with family. Breakfast from the garden was the highlight."],
  [5, "Spotless room, quiet nights and a host who answered within minutes."],
  [4, "Beautiful old house. The road up is narrow, but worth it."],
  [5, "We extended by a night. The terrace at sunset is something else."],
  [4, "Great value and very warm welcome. Water pressure could be better."],
  [5, "Clean, calm and close to everything we wanted to hike."],
] as const;

type Stay = {
  status: BookingStatus;
  checkIn: Date;
  nights: number;
  guest: (typeof GUESTS)[number];
  withAccount: boolean;
};

/** Stays for one room, back to back with gaps, never overlapping (the database would refuse it anyway). */
function planStays(next: () => number, today: Date): Stay[] {
  const stays: Stay[] = [];
  let day = addDays(today, -PAST_DAYS + Math.floor(next() * 5));
  while (day < addDays(today, FUTURE_DAYS)) {
    const nights = 1 + Math.floor(next() * 4);
    const future = day > today;
    const roll = next();
    let status: BookingStatus;
    if (future)
      status = roll < 0.6 ? "CONFIRMED" : roll < 0.8 ? "HELD" : roll < 0.9 ? "AWAITING_PAYMENT" : "CANCELLED";
    else
      status = roll < 0.78 ? "CONFIRMED" : roll < 0.86 ? "DECLINED" : roll < 0.93 ? "EXPIRED" : "CANCELLED";
    stays.push({
      status,
      checkIn: day,
      nights,
      guest: GUESTS[Math.floor(next() * GUESTS.length)]!,
      withAccount: next() < 0.15,
    });
    day = addDays(day, nights + 1 + Math.floor(next() * 6));
  }
  return stays;
}

export async function seedHistory(): Promise<number> {
  if ((await prisma.booking.count({ where: { reference: { startsWith: REFERENCE_PREFIX } } })) > 0) return 0;
  const today = todayUtc();
  const host = await prisma.user.findUniqueOrThrow({ where: { email: "host@mabeet.test" } });
  const guestAccount = await prisma.user.findUnique({ where: { email: "guest@mabeet.test" } });
  const businesses = await prisma.business.findMany({
    where: { name: { endsWith: "(demo)" } },
    include: { rooms: { where: { kind: "ROOM" } } },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  for (const [placeIndex, business] of businesses.entries()) {
    const next = random(placeIndex + 7);
    for (const [roomIndex, room] of business.rooms.entries()) {
      // Platform nights on some rooms, so "where bookings come from" isn't only direct.
      const platformRoom = roomIndex % 2 === 0;
      for (const stay of planStays(next, today)) {
        const checkOut = addDays(stay.checkIn, stay.nights);
        if (platformRoom && next() < 0.3 && stay.status === "CONFIRMED") {
          await prisma.occupancy.create({
            data: {
              businessId: business.id,
              roomId: room.id,
              checkIn: stay.checkIn,
              checkOut,
              kind: "IMPORTED",
              source: next() < 0.6 ? "AIRBNB" : "BOOKING",
              externalUid: `demo-${room.id}-${stay.checkIn.toISOString().slice(0, 10)}`,
            },
          });
          continue;
        }
        const createdAt = addDays(stay.checkIn, -(3 + Math.floor(next() * 30)));
        const decided = stay.status !== "HELD" && stay.status !== "EXPIRED";
        const totalCents = room.baseRateCents * stay.nights;
        const depositCents = Math.ceil((totalCents * business.depositPercent) / 100);
        const booking = await prisma.booking.create({
          data: {
            reference: `${REFERENCE_PREFIX}${(created + 1).toString(36).toUpperCase().padStart(4, "0")}`,
            publicToken: secureToken(),
            businessId: business.id,
            roomId: room.id,
            guestUserId: stay.withAccount ? (guestAccount?.id ?? null) : null,
            guestName: stay.withAccount && guestAccount ? guestAccount.name : stay.guest[0],
            guestPhone: stay.guest[1],
            guestEmail: null,
            guestCount: Math.min(room.capacity, 1 + Math.floor(next() * room.capacity)),
            checkIn: stay.checkIn,
            checkOut,
            totalCents,
            depositCents,
            currency: business.currency,
            status: stay.status,
            holdExpiresAt:
              stay.status === "HELD" || stay.status === "AWAITING_PAYMENT" ? addDays(today, 1) : null,
            decidedById: decided ? host.id : null,
            decidedAt: decided
              ? new Date(createdAt.getTime() + (8 + Math.floor(next() * 240)) * 60_000)
              : null,
            createdAt,
            occupancy: {
              create: {
                businessId: business.id,
                roomId: room.id,
                checkIn: stay.checkIn,
                checkOut,
                kind: "DIRECT",
                active: isActiveBooking(stay.status),
              },
            },
          },
        });
        created += 1;
        await prisma.activityLog.create({
          data: {
            businessId: business.id,
            action: "booking.requested",
            entity: "booking",
            entityId: booking.id,
            createdAt,
          },
        });
        if (decided && booking.decidedAt) {
          await prisma.activityLog.create({
            data: {
              userId: host.id,
              businessId: business.id,
              action: `booking.${stay.status.toLowerCase()}`,
              entity: "booking",
              entityId: booking.id,
              createdAt: booking.decidedAt,
            },
          });
        }
        if (stay.status !== "CONFIRMED") continue;

        // Deposits: most recorded by hand; the first place also took some online through Mabeet.
        const online = placeIndex === 0 && stay.checkIn < today && next() < 0.5;
        const method: PaymentMethod = online
          ? "WHISH"
          : (["WHISH", "OMT", "CASH", "BANK_TRANSFER"] as const)[Math.floor(next() * 4)]!;
        await prisma.payment.create({
          data: {
            businessId: business.id,
            bookingId: booking.id,
            amountCents: depositCents,
            currency: business.currency,
            method,
            status: "PAID",
            online,
            paidAt: booking.decidedAt,
            recordedById: online ? null : host.id,
            createdAt: booking.decidedAt ?? createdAt,
          },
        });
        // Reviews on most finished stays.
        if (checkOut <= today && next() < 0.6) {
          const [rating, comment] = REVIEWS[Math.floor(next() * REVIEWS.length)]!;
          await prisma.review.create({
            data: {
              businessId: business.id,
              roomId: room.id,
              bookingId: booking.id,
              authorId: booking.guestUserId,
              rating,
              cleanliness: rating,
              location: 5,
              value: Math.max(3, rating - 1),
              comment,
              createdAt: addDays(checkOut, 2),
            },
          });
          await prisma.activityLog.create({
            data: {
              businessId: business.id,
              action: "review.submitted",
              entity: "review",
              entityId: booking.id,
              createdAt: addDays(checkOut, 2),
            },
          });
        }
      }
    }

    // Mabeet's revenue: five months of Pro for every demo place, by card or Whish.
    for (let monthsAgo = 5; monthsAgo >= 1; monthsAgo -= 1) {
      const paidAt = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 3 + placeIndex),
      );
      await prisma.planPayment.create({
        data: {
          businessId: business.id,
          plan: "PRO",
          amountCents: 1_000,
          currency: "USD",
          method: placeIndex % 2 === 0 ? "STRIPE" : "WHISH",
          status: "PAID",
          providerRef: `demo-plan-${business.id}-${monthsAgo}`,
          paidAt,
          createdAt: paidAt,
        },
      });
    }
  }

  // Payouts for the first place: one already sent, one waiting for the admin.
  const first = businesses[0];
  if (first) {
    await prisma.payout.createMany({
      data: [
        {
          businessId: first.id,
          amountCents: 10_000,
          currency: first.currency,
          method: "WHISH",
          accountName: "Demo Host",
          whishPhone: "+96170000000",
          status: "PAID",
          requestedById: host.id,
          reference: "WH-DEMO-1",
          decidedAt: addDays(today, -20),
          createdAt: addDays(today, -22),
        },
        {
          businessId: first.id,
          amountCents: 6_000,
          currency: first.currency,
          method: "BANK_TRANSFER",
          accountName: "Demo Host",
          bankName: "Demo Bank",
          iban: "LB62099900000001001901229114",
          status: "REQUESTED",
          requestedById: host.id,
          createdAt: addDays(today, -2),
        },
      ],
    });
    await prisma.activityLog.create({
      data: {
        userId: host.id,
        businessId: first.id,
        action: "payout.requested",
        entity: "payout",
        createdAt: addDays(today, -2),
      },
    });
  }

  // The demo host shows a profile on their listings.
  await prisma.hostProfile.upsert({
    where: { userId: host.id },
    create: {
      userId: host.id,
      displayName: "Rima",
      bio: "I grew up in these mountains and restored my grandparents' houses one by one. I'll tell you which trails to take and where the best manakish is.",
      city: "Chouf",
      languages: ["ar", "en", "fr"],
      hostingSince: 2019,
      whatsapp: "+96170000000",
      showOnListings: true,
    },
    update: {},
  });
  return created;
}
