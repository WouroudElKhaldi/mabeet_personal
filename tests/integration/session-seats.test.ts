import { beforeEach, describe, expect, it } from "vitest";
import { addDays, toIsoDate, todayUtc } from "@/lib/dates";
import type { TenantContext } from "@/server/auth/tenant-context";
import { AppError } from "@/server/errors";
import { addSessions, createOffering } from "@/server/services/offering-service";
import {
  confirmSessionBooking,
  declineSessionBooking,
  requestSessionBooking,
} from "@/server/services/session-booking-service";
import { createPlace, prisma, resetDatabase } from "./helpers";

const PARALLEL_GUESTS = 20;

async function experienceWithSession(
  ctx: TenantContext,
  capacity: number,
  priceUnit: "PER_PERSON" | "PER_GROUP" = "PER_PERSON",
) {
  const offering = await createOffering(ctx, {
    kind: "EXPERIENCE",
    title: `Cedar hike ${Math.random().toString(36).slice(2, 8)}`,
    durationMinutes: 180,
    priceCents: 3_500,
    priceUnit,
    maxGuests: 10,
    included: [],
    notIncluded: [],
    accessibility: [],
    languages: [],
    tags: [],
    cancellationHours: 24,
  });
  await addSessions(ctx, offering.id, {
    dates: [toIsoDate(addDays(todayUtc(), 7))],
    time: "09:00",
    capacity,
  });
  const session = await prisma.offeringSession.findFirstOrThrow({ where: { offeringId: offering.id } });
  return { offering, session };
}

const request = (slug: string, sessionId: string, seats: number, phone = "+96171123456") => ({
  offeringSlug: slug,
  sessionId,
  seats,
  guestName: "Maya Haddad",
  guestPhone: phone,
  guestEmail: null,
  guestNote: null,
  guestUserId: null,
});

const seatsHeld = (sessionId: string) =>
  prisma.sessionBooking
    .aggregate({ where: { sessionId, status: { in: ["HELD", "CONFIRMED"] } }, _sum: { seats: true } })
    .then((result) => result._sum.seats ?? 0);

describe("experience and service sessions: seats are never oversold", () => {
  beforeEach(resetDatabase);

  it(`gives the last 5 seats to exactly 5 of ${PARALLEL_GUESTS} guests asking at once`, async () => {
    const { ctx } = await createPlace();
    const { offering, session } = await experienceWithSession(ctx, 5);

    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL_GUESTS }, () =>
        requestSessionBooking(request(offering.slug, session.id, 1)),
      ),
    );

    const losers = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    for (const { reason } of losers) {
      expect(reason).toBeInstanceOf(AppError);
      expect((reason as AppError).code).toBe("CONFLICT");
    }
    expect(await seatsHeld(session.id)).toBe(5);
  });

  it("never lets parallel groups add up to more than the capacity", async () => {
    const { ctx } = await createPlace();
    const { offering, session } = await experienceWithSession(ctx, 8);
    await Promise.allSettled(
      Array.from({ length: 6 }, () => requestSessionBooking(request(offering.slug, session.id, 3))),
    );
    expect(await seatsHeld(session.id)).toBe(6);
  });

  it("is enforced by the database itself, even for a row inserted by hand", async () => {
    const { ctx, business } = await createPlace();
    const { offering, session } = await experienceWithSession(ctx, 2);
    const row = (reference: string, seats: number) => ({
      reference,
      publicToken: `${reference}-token-long-enough`,
      businessId: business.id,
      offeringId: offering.id,
      sessionId: session.id,
      guestName: "Hand typed",
      guestPhone: "+96170000000",
      seats,
      totalCents: 0,
      depositCents: 0,
      currency: "USD",
    });
    await prisma.sessionBooking.create({ data: row("SN-HAND01", 2) });
    await expect(prisma.sessionBooking.create({ data: row("SN-HAND02", 1) })).rejects.toThrow();
    await expect(
      prisma.offeringSession.update({ where: { id: session.id }, data: { capacity: 1 } }),
    ).rejects.toThrow();
  });

  it("frees the seats when the host declines", async () => {
    const { ctx } = await createPlace();
    const { offering, session } = await experienceWithSession(ctx, 2);
    const first = await requestSessionBooking(request(offering.slug, session.id, 2));
    await expect(
      requestSessionBooking(request(offering.slug, session.id, 1, "+96171000002")),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await declineSessionBooking(ctx, first.id);
    await expect(
      requestSessionBooking(request(offering.slug, session.id, 2, "+96171000003")),
    ).resolves.toBeDefined();
  });

  it("prices per person or once per group", async () => {
    const { ctx } = await createPlace();
    const perPerson = await experienceWithSession(ctx, 10, "PER_PERSON");
    const perGroup = await experienceWithSession(ctx, 10, "PER_GROUP");
    const a = await requestSessionBooking(request(perPerson.offering.slug, perPerson.session.id, 3));
    const b = await requestSessionBooking(
      request(perGroup.offering.slug, perGroup.session.id, 3, "+96171000004"),
    );
    expect(a.totalCents).toBe(3 * 3_500);
    expect(b.totalCents).toBe(3_500);
  });

  it("keeps businesses apart: another workspace cannot confirm this booking", async () => {
    const mine = await createPlace("Beit Alpha");
    const theirs = await createPlace("Beit Bravo");
    const { offering, session } = await experienceWithSession(mine.ctx, 4);
    const booking = await requestSessionBooking(request(offering.slug, session.id, 1));
    await expect(confirmSessionBooking(theirs.ctx, booking.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(confirmSessionBooking(mine.ctx, booking.id)).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("refuses sessions in the past", async () => {
    const { ctx } = await createPlace();
    const { offering } = await experienceWithSession(ctx, 4);
    await expect(
      addSessions(ctx, offering.id, {
        dates: [toIsoDate(addDays(todayUtc(), -1))],
        time: "09:00",
        capacity: 4,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
