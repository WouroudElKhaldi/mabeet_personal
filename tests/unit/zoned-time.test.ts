import { describe, expect, it } from "vitest";
import { zonedInstant } from "@/lib/zoned-time";

describe("zonedInstant", () => {
  it("reads a Beirut wall-clock time in summer (UTC+3)", () => {
    expect(zonedInstant("2026-07-15", "17:00", "Asia/Beirut").toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });

  it("reads a Beirut wall-clock time in winter (UTC+2)", () => {
    expect(zonedInstant("2026-12-15", "17:00", "Asia/Beirut").toISOString()).toBe("2026-12-15T15:00:00.000Z");
  });

  it("is the identity for UTC", () => {
    expect(zonedInstant("2026-03-01", "09:30", "UTC").toISOString()).toBe("2026-03-01T09:30:00.000Z");
  });
});
