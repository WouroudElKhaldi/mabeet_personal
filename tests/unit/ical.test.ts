import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { buildExportFeed } from "@/server/ical/build-feed";
import { parseFeed } from "@/server/ical/parse-feed";
import { assertPublicHttpsUrl, fetchCalendarText } from "@/server/ical/safe-fetch";

const ics = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", ...events, "END:VCALENDAR"].join("\r\n");

const event = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

const window = {
  from: parseIsoDate("2026-10-22"),
  to: parseIsoDate("2027-10-22"),
  timezone: "Asia/Beirut",
};

const summary = (text: string) =>
  parseFeed(text, window).map((e) => [e.uid, toIsoDate(e.checkIn), toIsoDate(e.checkOut)]);

describe("parseFeed", () => {
  it("reads Airbnb-style all-day reservations as [checkIn, checkOut)", () => {
    const feed = ics(
      event([
        "UID:1418fb94e984-abc@airbnb.com",
        "DTSTART;VALUE=DATE:20261101",
        "DTEND;VALUE=DATE:20261104",
        "SUMMARY:Reserved",
      ]),
    );
    expect(summary(feed)).toEqual([["1418fb94e984-abc@airbnb.com", "2026-11-01", "2026-11-04"]]);
  });

  it("converts date-time events to the property's calendar dates", () => {
    // 23:30 UTC on 9 Nov is already 10 Nov in Beirut (UTC+2).
    const feed = ics(event(["UID:bdc-1", "DTSTART:20261109T233000Z", "DTEND:20261112T080000Z"]));
    expect(summary(feed)).toEqual([["bdc-1", "2026-11-10", "2026-11-12"]]);
  });

  it("treats a missing DTEND as a single night", () => {
    expect(summary(ics(event(["UID:one", "DTSTART;VALUE=DATE:20261201"])))).toEqual([
      ["one", "2026-12-01", "2026-12-02"],
    ]);
  });

  it("drops cancelled, past, far-future and UID-less events", () => {
    const feed = ics(
      event([
        "UID:cancelled",
        "STATUS:CANCELLED",
        "DTSTART;VALUE=DATE:20261105",
        "DTEND;VALUE=DATE:20261106",
      ]),
      event(["UID:past", "DTSTART;VALUE=DATE:20260101", "DTEND;VALUE=DATE:20260105"]),
      event(["UID:far", "DTSTART;VALUE=DATE:20280101", "DTEND;VALUE=DATE:20280105"]),
      event(["DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261111"]),
    );
    expect(summary(feed)).toEqual([]);
  });

  it("keeps a stay that started before the window but is still running", () => {
    const feed = ics(event(["UID:ongoing", "DTSTART;VALUE=DATE:20261020", "DTEND;VALUE=DATE:20261025"]));
    expect(summary(feed)).toEqual([["ongoing", "2026-10-20", "2026-10-25"]]);
  });
});

describe("buildExportFeed", () => {
  const feed = buildExportFeed("Beit Test · Cedar", [
    { id: "occ1", checkIn: parseIsoDate("2026-11-01"), checkOut: parseIsoDate("2026-11-03") },
  ]);

  it("round-trips through our own parser", () => {
    expect(summary(feed)).toEqual([["occ1@se-next-stays", "2026-11-01", "2026-11-03"]]);
  });

  it("never carries guest details", () => {
    expect(feed).toContain("SUMMARY:Not available");
    expect(feed).not.toMatch(/ATTENDEE|ORGANIZER|DESCRIPTION|\+961/);
  });
});

describe("assertPublicHttpsUrl", () => {
  it.each([
    ["http://calendar.example.com/feed.ics", /https/],
    ["https://127.0.0.1/feed.ics", /private/],
    ["https://10.1.2.3/feed.ics", /private/],
    ["https://192.168.1.10/feed.ics", /private/],
    ["https://169.254.169.254/latest/meta-data", /private/],
    ["https://[::1]/feed.ics", /private/],
    ["https://[::ffff:127.0.0.1]/feed.ics", /private/],
    ["https://user:pass@8.8.8.8/feed.ics", /credentials/],
  ])("refuses %s", async (url, message) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow(message);
  });

  it("accepts a public https address", async () => {
    await expect(assertPublicHttpsUrl("https://8.8.8.8/feed.ics")).resolves.toBeInstanceOf(URL);
  });
});

describe("fetchCalendarText", () => {
  // A literal public address: the resolver answers without the network, and fetch itself is stubbed.
  const FEED_URL = "https://8.8.8.8/feed.ics";

  afterEach(() => vi.unstubAllGlobals());

  const respondWith = (body: string, headers: Record<string, string> = {}) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { headers })),
    );

  it("returns an iCal body", async () => {
    respondWith("BEGIN:VCALENDAR\nEND:VCALENDAR");
    await expect(fetchCalendarText(FEED_URL)).resolves.toContain("BEGIN:VCALENDAR");
  });

  it("refuses a body that is not iCal", async () => {
    respondWith("<html>sign in</html>");
    await expect(fetchCalendarText(FEED_URL)).rejects.toThrow(/not an iCal/);
  });

  it("refuses a feed whose declared size is over the cap without reading it", async () => {
    respondWith("BEGIN:VCALENDAR", { "content-length": String(3_000_000) });
    await expect(fetchCalendarText(FEED_URL)).rejects.toThrow(/too large/);
  });

  it("stops reading a feed that grows past the cap", async () => {
    respondWith(`BEGIN:VCALENDAR\n${"x".repeat(2_100_000)}`);
    await expect(fetchCalendarText(FEED_URL)).rejects.toThrow(/too large/);
  });
});
