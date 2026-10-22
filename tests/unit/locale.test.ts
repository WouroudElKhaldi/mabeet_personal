import { describe, expect, it } from "vitest";
import { categoryName, isArabic, pickLocale } from "@/config/appearance";

describe("locales", () => {
  it("keeps a saved choice, including Lebanese", () => {
    expect(pickLocale("ar-LB", "en-US")).toBe("ar-LB");
    expect(pickLocale("en", "ar")).toBe("en");
  });

  it("falls back to the browser's languages", () => {
    expect(pickLocale(undefined, "ar-LB,ar;q=0.9")).toBe("ar-LB");
    expect(pickLocale(undefined, "ar-SA")).toBe("ar");
    expect(pickLocale("klingon", "fr-FR")).toBe("en");
    expect(pickLocale(undefined, null)).toBe("en");
  });

  it("reads both Arabic variants right to left, with Arabic category names", () => {
    expect([isArabic("ar"), isArabic("ar-LB"), isArabic("en")]).toEqual([true, true, false]);
    expect(categoryName({ nameEn: "Mountain", nameAr: "جبل" }, "ar-LB")).toBe("جبل");
    expect(categoryName({ nameEn: "Mountain", nameAr: "جبل" }, "en")).toBe("Mountain");
  });
});
