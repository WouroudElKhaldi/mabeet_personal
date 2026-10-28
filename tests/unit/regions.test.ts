import { describe, expect, it } from "vitest";
import { areasMatching } from "@/config/regions";

describe("areasMatching", () => {
  it("turns a region's name, in any of its spellings, into its towns", () => {
    for (const name of ["North Lebanon", "north", "The North", "الشمال", "shmal"])
      expect(areasMatching(name)).toContain("ehden");
    expect(areasMatching("Bekaa")).toContain("zahle");
  });

  it("keeps a town as typed", () => {
    expect(areasMatching(" Batroun ")).toEqual(["Batroun"]);
  });
});
