import { beforeEach, describe, expect, it } from "vitest";
import { requestBooking } from "@/server/services/booking-service";
import { addBlock } from "@/server/services/calendar-service";
import { createRoom } from "@/server/services/room-service";
import { updateSettings } from "@/server/services/settings-service";
import { createPlace, guestRequest, prisma, resetDatabase, stay } from "./helpers";

describe("booking a place as a whole", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;
  let second: { id: string };

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
    second = await createRoom(place.ctx, {
      name: "Garden room",
      capacity: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      baseRateCents: 7_000,
      minNights: 1,
      amenities: [],
    });
    await updateSettings(place.ctx, { bookingUnit: "WHOLE_PLACE" });
  });

  const unit = () =>
    prisma.room.findFirstOrThrow({ where: { businessId: place.business.id, kind: "WHOLE_PLACE" } });

  it("starts the whole-place unit from the rooms, once", async () => {
    expect(await unit()).toMatchObject({ capacity: 4, baseRateCents: 16_000 });
    await updateSettings(place.ctx, { bookingUnit: "WHOLE_PLACE" });
    expect(await prisma.room.count({ where: { businessId: place.business.id, kind: "WHOLE_PLACE" } })).toBe(
      1,
    );
  });

  it("books the whole place, and no single room any more", async () => {
    await expect(
      requestBooking(guestRequest(place.business.slug, (await unit()).id, 20, 2)),
    ).resolves.toBeDefined();
    await expect(
      requestBooking(guestRequest(place.business.slug, place.room.id, 40, 2)),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses the whole place when one room's nights are closed", async () => {
    await addBlock(place.ctx, { roomId: second.id, range: stay(20, 1), source: "KAZDERNI", note: null });
    await expect(
      requestBooking(guestRequest(place.business.slug, (await unit()).id, 19, 3)),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("goes back to rooms, which then can't take nights the whole place holds", async () => {
    await requestBooking(guestRequest(place.business.slug, (await unit()).id, 20, 2));
    await updateSettings(place.ctx, { bookingUnit: "ROOMS" });
    await expect(
      requestBooking(guestRequest(place.business.slug, place.room.id, 21, 1)),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      requestBooking(guestRequest(place.business.slug, place.room.id, 30, 1)),
    ).resolves.toBeDefined();
  });
});
