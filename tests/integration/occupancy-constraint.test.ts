import { beforeEach, describe, expect, it } from "vitest";
import { isOverlapError } from "@/server/db/client";
import { requestBooking } from "@/server/services/booking-service";
import { createPlace, guestRequest, prisma, resetDatabase, stay } from "./helpers";

/** Guards the hand-written EXCLUDE constraint: if a migration ever drops it, this fails. */
describe("occupancy no-overlap constraint (database level)", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
  });

  const occupy = (
    startOffset: number,
    nights: number,
    extra: { kind?: "DIRECT" | "MANUAL" | "IMPORTED"; active?: boolean } = {},
  ) =>
    prisma.occupancy.create({
      data: {
        businessId: place.business.id,
        roomId: place.room.id,
        kind: extra.kind ?? "MANUAL",
        active: extra.active ?? true,
        ...stay(startOffset, nights),
      },
    });

  it("rejects a second active range that overlaps the first", async () => {
    await occupy(10, 3);
    const error = await occupy(11, 3).catch((caught: unknown) => caught);
    expect(isOverlapError(error)).toBe(true);
  });

  it("allows back-to-back stays (check-out day = next check-in day)", async () => {
    await occupy(10, 3);
    await expect(occupy(13, 2)).resolves.toBeDefined();
  });

  it("ignores inactive rows, so cancelled bookings free their nights", async () => {
    await occupy(10, 3, { active: false });
    await expect(occupy(10, 3)).resolves.toBeDefined();
  });

  it("lets imported platform events overlap each other", async () => {
    await occupy(10, 3, { kind: "IMPORTED" });
    await expect(occupy(10, 3, { kind: "IMPORTED" })).resolves.toBeDefined();
  });

  it("rejects an empty or reversed range", async () => {
    await expect(occupy(10, 0)).rejects.toThrow();
  });
});

/** Guards the hand-written CHECK constraints that back up the route validation. */
describe("sane values (database level)", () => {
  beforeEach(resetDatabase);

  it("refuses a booking for no guests, or a payment of zero", async () => {
    const { business, room } = await createPlace();
    const booking = await requestBooking(guestRequest(business.slug, room.id, 10, 2));

    await expect(
      prisma.booking.update({ where: { id: booking.id }, data: { guestCount: 0 } }),
    ).rejects.toThrow(/booking_positive_guests/);
    await expect(
      prisma.payment.create({
        data: {
          businessId: business.id,
          bookingId: booking.id,
          amountCents: 0,
          currency: "USD",
          method: "CASH",
        },
      }),
    ).rejects.toThrow(/payment_positive_amount/);
  });
});
