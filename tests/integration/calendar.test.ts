import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, todayUtc, toIsoDate } from "@/lib/dates";
import { requestBooking } from "@/server/services/booking-service";
import {
  addBlock,
  addFeed,
  buildRoomExport,
  getCalendar,
  removeBlock,
  syncFeed,
} from "@/server/services/calendar-service";
import { createPlace, guestRequest, memberWith, prisma, resetDatabase, stay } from "./helpers";

const remoteFeed = vi.hoisted(() => ({ text: "" }));

vi.mock("@/server/ical/safe-fetch", () => ({
  assertPublicHttpsUrl: async (url: string) => new URL(url),
  fetchCalendarText: async () => {
    if (!remoteFeed.text) throw new Error("The calendar link answered with status 404");
    return remoteFeed.text;
  },
}));

const icsDate = (offset: number) => toIsoDate(addDays(todayUtc(), offset)).replaceAll("-", "");

function airbnbFeed(...events: Array<{ uid: string; from: number; nights: number }>) {
  const body = events.map(({ uid, from, nights }) =>
    [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${icsDate(from)}`,
      `DTEND;VALUE=DATE:${icsDate(from + nights)}`,
      "SUMMARY:Reserved",
      "END:VEVENT",
    ].join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...body, "END:VCALENDAR"].join("\r\n");
}

describe("calendar sync, blocks and export", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
  });

  const block = (startOffset: number, nights: number) =>
    addBlock(place.ctx, {
      roomId: place.room.id,
      range: stay(startOffset, nights),
      source: "KAZDERNI",
      note: "Booked on Kazderni",
    });

  const newFeed = () =>
    addFeed(place.ctx, {
      roomId: place.room.id,
      url: "https://www.airbnb.com/calendar/ical/1.ics",
      source: "AIRBNB",
    });

  it("records a Kazderni booking as a manual block that stops direct bookings", async () => {
    await block(20, 3);
    await expect(
      requestBooking(guestRequest(place.business.slug, place.room.id, 21, 1)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a block over nights a guest already holds, and frees nights when removed", async () => {
    await requestBooking(guestRequest(place.business.slug, place.room.id, 20, 2));
    await expect(block(21, 2)).rejects.toMatchObject({ code: "CONFLICT" });
    const kazderni = await block(30, 2);
    await removeBlock(place.ctx, kazderni.id);
    await expect(block(30, 2)).resolves.toBeDefined();
  });

  it("imports platform reservations, then drops the ones cancelled on the platform", async () => {
    remoteFeed.text = airbnbFeed(
      { uid: "a@airbnb", from: 40, nights: 2 },
      { uid: "b@airbnb", from: 50, nights: 3 },
    );
    const feed = await newFeed();
    expect(await prisma.occupancy.count({ where: { feedId: feed.id, active: true } })).toBe(2);

    remoteFeed.text = airbnbFeed({ uid: "b@airbnb", from: 50, nights: 3 });
    await expect(syncFeed(place.business.id, feed.id)).resolves.toMatchObject({ ok: true });
    expect(await prisma.occupancy.count({ where: { feedId: feed.id, active: true } })).toBe(1);
  });

  it("flags a platform booking that collides with one of ours instead of cancelling either", async () => {
    const direct = await requestBooking(guestRequest(place.business.slug, place.room.id, 60, 3));
    remoteFeed.text = airbnbFeed({ uid: "clash@airbnb", from: 61, nights: 1 });
    const feed = await newFeed();
    expect(await syncFeed(place.business.id, feed.id)).toMatchObject({ ok: true, conflicts: 1 });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: direct.id } })).toMatchObject({
      status: "HELD",
    });
  });

  it("records a broken feed's error for the owner to see", async () => {
    remoteFeed.text = "";
    const feed = await newFeed();
    expect(await prisma.calendarFeed.findUniqueOrThrow({ where: { id: feed.id } })).toMatchObject({
      lastError: "The calendar link answered with status 404",
    });
  });

  it("exports held bookings and blocks, but never imported nights or guest details", async () => {
    await requestBooking(guestRequest(place.business.slug, place.room.id, 70, 2));
    await block(80, 1);
    remoteFeed.text = airbnbFeed({ uid: "echo@airbnb", from: 90, nights: 2 });
    await newFeed();

    const ics = await buildRoomExport(place.room.exportToken);
    expect(ics?.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).not.toContain("echo@airbnb");
    expect(ics).not.toContain("Maya");
    expect(await buildRoomExport("unknown-token-that-is-long-enough")).toBeNull();
  });

  it("shows the calendar only to members with calendar.read", async () => {
    await block(20, 2);
    const range = { checkIn: todayUtc(), checkOut: addDays(todayUtc(), 30) };
    expect(await getCalendar(place.ctx, range)).toHaveLength(1);
    const outsider = await memberWith(place.business.id, ["bookings.read"]);
    await expect(getCalendar(outsider, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
