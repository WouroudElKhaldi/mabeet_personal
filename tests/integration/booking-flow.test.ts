import { beforeEach, describe, expect, it } from "vitest";
import {
  cancelBooking,
  confirmBooking,
  declineBooking,
  getBooking,
  requestBooking,
} from "@/server/services/booking-service";
import { createPlace, guestRequest, memberWith, prisma, resetDatabase, stay } from "./helpers";

const HOUR = 3_600_000;

describe("booking lifecycle", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
  });

  const request = (startOffset = 15, nights = 2, now?: Date) =>
    requestBooking(guestRequest(place.business.slug, place.room.id, startOffset, nights), now);

  it("prices the stay and holds the room until the owner decides", async () => {
    const booking = await request();
    expect(booking.status).toBe("HELD");
    expect(booking.totalCents).toBe(18_000);
    expect(booking.depositCents).toBe(5_400);
    expect(booking.reference).toMatch(/^SN-[A-Z2-9]{6}$/);
  });

  it("confirms a held booking and keeps blocking its nights", async () => {
    const booking = await request();
    const confirmed = await confirmBooking(place.ctx, { bookingId: booking.id });
    expect(confirmed.status).toBe("CONFIRMED");
    await expect(request()).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("frees the nights when the owner declines", async () => {
    const booking = await request();
    await declineBooking(place.ctx, { bookingId: booking.id, reason: "Closed for repairs" });
    await expect(request()).resolves.toMatchObject({ status: "HELD" });
  });

  it("frees the nights when a confirmed booking is cancelled", async () => {
    const booking = await request();
    await confirmBooking(place.ctx, { bookingId: booking.id });
    await cancelBooking(place.ctx, { bookingId: booking.id, reason: "Guest cancelled" });
    await expect(request()).resolves.toMatchObject({ status: "HELD" });
  });

  it("expires a hold nobody answered, so the next guest can book", async () => {
    const stale = await request();
    const afterHold = new Date(Date.now() + (place.business.holdHours + 1) * HOUR);
    await expect(request(15, 2, afterHold)).resolves.toMatchObject({ status: "HELD" });
    expect(await prisma.booking.findUnique({ where: { id: stale.id } })).toMatchObject({ status: "EXPIRED" });
  });

  it("refuses to confirm a hold that already expired", async () => {
    const booking = await request();
    const afterHold = new Date(Date.now() + (place.business.holdHours + 1) * HOUR);
    await expect(confirmBooking(place.ctx, { bookingId: booking.id }, afterHold)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("blocks direct requests over nights imported from Airbnb or Booking.com", async () => {
    await prisma.occupancy.create({
      data: {
        businessId: place.business.id,
        roomId: place.room.id,
        kind: "IMPORTED",
        source: "AIRBNB",
        ...stay(15, 1),
      },
    });
    await expect(request(14, 3)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects past dates, too many guests and unknown rooms", async () => {
    await expect(request(-2, 1)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      requestBooking({ ...guestRequest(place.business.slug, place.room.id, 15, 2), guestCount: 9 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      requestBooking(guestRequest(place.business.slug, "missing-room", 15, 2)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never lets a finished booking come back", async () => {
    const booking = await request();
    await declineBooking(place.ctx, { bookingId: booking.id });
    await expect(confirmBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("masks guest contact details for staff without the guests.contact permission", async () => {
    const booking = await request();
    const housekeeping = await memberWith(place.business.id, ["bookings.read"]);
    const seen = await getBooking(housekeeping, booking.id);
    expect(seen.guestPhone).toBe("+961••••3456");
    expect(seen.guestEmail).toBe("m•••@example.test");
    expect((await getBooking(place.ctx, booking.id)).guestPhone).toBe("+96171123456");
  });

  it("stops staff without bookings.decide from confirming", async () => {
    const booking = await request();
    const viewer = await memberWith(place.business.id, ["bookings.read"]);
    await expect(confirmBooking(viewer, { bookingId: booking.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
