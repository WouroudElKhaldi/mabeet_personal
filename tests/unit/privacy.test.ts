import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/lib/privacy";

describe("contact masking", () => {
  it("keeps the country code and last four digits of a phone", () => {
    expect(maskPhone("+96171123456")).toBe("+961••••3456");
  });

  it("fully hides very short numbers", () => {
    expect(maskPhone("+9611")).toBe("•••••");
  });

  it("keeps only the first letter and domain of an email", () => {
    expect(maskEmail("maya@example.com")).toBe("m•••@example.com");
  });
});
