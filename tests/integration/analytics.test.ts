import { beforeEach, describe, expect, it } from "vitest";
import { confirmBooking, requestBooking } from "@/server/services/booking-service";
import { getAnalytics } from "@/server/services/analytics-service";
import { addDays, todayUtc } from "@/lib/dates";
import { resolveContext } from "@/server/services/team-service";
import { createPlace, guestRequest, memberWith, prisma, resetDatabase } from "./helpers";

const range = { checkIn: addDays(todayUtc(), -1), checkOut: addDays(todayUtc(), 60) };

describe("analytics across places", () => {
  beforeEach(resetDatabase);

  it("adds up a person's places, and shows one place alone", async () => {
    const first = await createPlace("Beit One");
    const second = await createPlace("Beit Two");
    // The same owner runs both places.
    await prisma.membership.update({
      where: { id: second.ctx.membershipId },
      data: { userId: first.owner.id },
    });
    const secondCtx = (await resolveContext(first.owner.id, second.business.id))!;

    for (const [place, ctx, nights] of [
      [first, first.ctx, 2],
      [second, secondCtx, 3],
    ] as const) {
      const booking = await requestBooking(guestRequest(place.business.slug, place.room.id, 10, nights));
      await confirmBooking(ctx, { bookingId: booking.id });
    }

    const all = await getAnalytics(first.ctx, "all", range);
    expect(all.places).toHaveLength(2);
    expect(all.totals.nightsSold).toBe(5);
    expect(all.totals.revenue).toEqual({ USD: 2 * 9_000 + 3 * 9_000 });

    const one = await getAnalytics(first.ctx, "place", range);
    expect(one.places).toHaveLength(1);
    expect(one.totals.nightsSold).toBe(2);
  });

  it("is only for members allowed to see analytics, and never another business's", async () => {
    const mine = await createPlace("Mine");
    const theirs = await createPlace("Theirs");
    await requestBooking(guestRequest(theirs.business.slug, theirs.room.id, 10, 2));
    const frontDesk = await memberWith(mine.business.id, ["bookings.read"]);
    await expect(getAnalytics(frontDesk, "place", range)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const all = await getAnalytics(mine.ctx, "all", range);
    expect(all.places.map((place) => place.name)).toEqual(["Mine"]);
  });
});
