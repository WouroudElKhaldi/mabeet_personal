import { describe, expect, it } from "vitest";
import { countNights, eachNight, parseIsoDate, rangesOverlap, toIsoDate } from "@/lib/dates";

const range = (checkIn: string, checkOut: string) => ({
  checkIn: parseIsoDate(checkIn),
  checkOut: parseIsoDate(checkOut),
});

describe("dates", () => {
  it("parses ISO dates as UTC midnight and rejects impossible ones", () => {
    expect(toIsoDate(parseIsoDate("2026-10-31"))).toBe("2026-10-31");
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("31/10/2026")).toThrow(RangeError);
  });

  it("counts nights across month ends", () => {
    expect(countNights(range("2026-10-30", "2026-11-02"))).toBe(3);
    expect(eachNight(range("2026-10-30", "2026-11-01")).map(toIsoDate)).toEqual(["2026-10-30", "2026-10-31"]);
  });

  it("treats back-to-back stays as not overlapping", () => {
    expect(rangesOverlap(range("2026-11-01", "2026-11-03"), range("2026-11-03", "2026-11-05"))).toBe(false);
    expect(rangesOverlap(range("2026-11-01", "2026-11-04"), range("2026-11-03", "2026-11-05"))).toBe(true);
  });
});
