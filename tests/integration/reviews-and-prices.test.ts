import { beforeEach, describe, expect, it } from "vitest";
import { addDays, toIsoDate, todayUtc } from "@/lib/dates";
import { requestBooking } from "@/server/services/booking-service";
import { getPlace, searchOfferings } from "@/server/services/directory-service";
import { addSessions, createOffering } from "@/server/services/offering-service";
import { listSpecialPrices, setSpecialPrice } from "@/server/services/room-service";
import { listOfferingReviews, submitReview } from "@/server/services/review-service";
import { confirmSessionBooking, requestSessionBooking } from "@/server/services/session-booking-service";
import { createPlace, createUser, guestRequest, prisma, resetDatabase, stay } from "./helpers";

describe("special prices per night", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
    await prisma.business.update({ where: { id: place.business.id }, data: { listedPublicly: true } });
  });

  it("charges the special price on its nights and the base rate on the others", async () => {
    await setSpecialPrice(place.ctx, place.room.id, stay(10, 2), 15_000);
    const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 10, 3));
    expect(booking.totalCents).toBe(15_000 + 15_000 + 9_000);
  });

  it("lists runs of nights and clears them back to the base rate", async () => {
    await setSpecialPrice(place.ctx, place.room.id, stay(10, 3), 12_000);
    await setSpecialPrice(place.ctx, place.room.id, stay(13, 1), 20_000);
    expect(await listSpecialPrices(place.ctx, place.room.id)).toEqual([
      { from: toIsoDate(stay(10, 3).checkIn), to: toIsoDate(stay(10, 3).checkOut), rateCents: 12_000 },
      { from: toIsoDate(stay(13, 1).checkIn), to: toIsoDate(stay(13, 1).checkOut), rateCents: 20_000 },
    ]);
    await setSpecialPrice(place.ctx, place.room.id, stay(10, 4), null);
    expect(await listSpecialPrices(place.ctx, place.room.id)).toEqual([]);
  });
});

describe("reviews of experiences", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
    await prisma.business.update({ where: { id: place.business.id }, data: { listedPublicly: true } });
  });

  async function bookedSession() {
    const guest = await createUser("Maya Haddad");
    const offering = await createOffering(place.ctx, {
      kind: "EXPERIENCE",
      title: "Cedar walk",
      durationMinutes: 120,
      priceCents: 2_000,
      priceUnit: "PER_PERSON",
      maxGuests: 4,
      included: [],
      notIncluded: [],
      accessibility: [],
      languages: [],
      tags: [],
      cancellationHours: 24,
    });
    await addSessions(place.ctx, offering.id, {
      dates: [toIsoDate(addDays(todayUtc(), 3))],
      time: "10:00",
      capacity: 4,
    });
    const session = await prisma.offeringSession.findFirstOrThrow({ where: { offeringId: offering.id } });
    const booking = await requestSessionBooking({
      offeringSlug: offering.slug,
      sessionId: session.id,
      seats: 2,
      guestName: guest.name,
      guestPhone: "+96171000001",
      guestEmail: null,
      guestNote: null,
      guestUserId: guest.id,
    });
    await confirmSessionBooking(place.ctx, booking.id);
    return { guest, offering, booking, afterwards: addDays(session.endsAt, 1) };
  }

  it("lets the guest review once the session has ended, and only once", async () => {
    const { guest, offering, booking, afterwards } = await bookedSession();
    const review = { sessionBookingId: booking.id, rating: 5, comment: "A beautiful morning walk." };

    await expect(submitReview(guest.id, review)).rejects.toMatchObject({ code: "VALIDATION" });
    await submitReview(guest.id, review, afterwards);
    await expect(submitReview(guest.id, review, afterwards)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await listOfferingReviews(offering.id)).toHaveLength(1);
    const [card] = await searchOfferings({ limit: 10 });
    expect(card?.rating).toEqual({ average: 5, count: 1 });
  });

  it("keeps experience ratings out of the place's own rating", async () => {
    const { guest, booking, afterwards } = await bookedSession();
    await submitReview(
      guest.id,
      { sessionBookingId: booking.id, rating: 2, comment: "Too short for me." },
      afterwards,
    );
    expect((await getPlace(place.business.slug)).rating).toEqual({ average: 0, count: 0 });
  });

  it("refuses someone else's booking", async () => {
    const { booking, afterwards } = await bookedSession();
    const stranger = await createUser("Stranger");
    await expect(
      submitReview(
        stranger.id,
        { sessionBookingId: booking.id, rating: 1, comment: "Never went there." },
        afterwards,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
