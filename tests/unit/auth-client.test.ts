import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth-client";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/account?tab=trips")).toBe("/account?tab=trips");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null])(
    "falls back for %s",
    (next) => {
      expect(safeNextPath(next, "/home")).toBe("/home");
    },
  );
});
