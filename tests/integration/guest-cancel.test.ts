import { beforeEach, describe, expect, it } from "vitest";
import { addDays, toIsoDate, todayUtc } from "@/lib/dates";
import { cancelStayAsGuest, confirmBooking, requestBooking } from "@/server/services/booking-service";
import { addSessions, createOffering } from "@/server/services/offering-service";
import { cancelSessionAsGuest, requestSessionBooking } from "@/server/services/session-booking-service";
import { createPlace, guestRequest, prisma, resetDatabase } from "./helpers";

describe("guests cancel from their private link", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
    await prisma.business.update({ where: { id: place.business.id }, data: { listedPublicly: true } });
  });

  it("cancels a held stay and frees the nights for the next guest", async () => {
    const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 20, 2));
    const cancelled = await cancelStayAsGuest(booking.publicToken, "Plans changed");
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Plans changed" });
    await expect(
      requestBooking(guestRequest(place.business.slug, place.room.id, 20, 2)),
    ).resolves.toBeDefined();
  });

  it("cancels a confirmed stay before check-in, but not after it started", async () => {
    const upcoming = await requestBooking(guestRequest(place.business.slug, place.room.id, 30, 2));
    await confirmBooking(place.ctx, { bookingId: upcoming.id });
    await expect(cancelStayAsGuest(upcoming.publicToken, null)).resolves.toMatchObject({
      status: "CANCELLED",
    });

    const started = await requestBooking(guestRequest(place.business.slug, place.room.id, 40, 2));
    const duringStay = addDays(started.checkIn, 1);
    await expect(cancelStayAsGuest(started.publicToken, null, duringStay)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("never cancels twice, and ignores unknown links", async () => {
    const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 50, 2));
    await cancelStayAsGuest(booking.publicToken, null);
    await expect(cancelStayAsGuest(booking.publicToken, null)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(cancelStayAsGuest("not-a-real-token-at-all-000000", null)).resolves.toBeNull();
  });

  it("cancels seats in a session and frees them", async () => {
    const offering = await createOffering(place.ctx, {
      kind: "EXPERIENCE",
      title: "Cedar walk",
      durationMinutes: 120,
      priceCents: 2_000,
      priceUnit: "PER_PERSON",
      maxGuests: 2,
      included: [],
      notIncluded: [],
      accessibility: [],
      languages: [],
      tags: [],
      cancellationHours: 24,
    });
    await addSessions(place.ctx, offering.id, {
      dates: [toIsoDate(addDays(todayUtc(), 5))],
      time: "10:00",
      capacity: 2,
    });
    const session = await prisma.offeringSession.findFirstOrThrow({ where: { offeringId: offering.id } });
    const request = (phone: string) =>
      requestSessionBooking({
        offeringSlug: offering.slug,
        sessionId: session.id,
        seats: 2,
        guestName: "Maya Haddad",
        guestPhone: phone,
        guestEmail: null,
        guestNote: null,
        guestUserId: null,
      });
    const first = await request("+96171000001");
    await expect(request("+96171000002")).rejects.toMatchObject({ code: "CONFLICT" });
    await cancelSessionAsGuest(first.publicToken, null);
    await expect(request("+96171000003")).resolves.toBeDefined();
  });
});
