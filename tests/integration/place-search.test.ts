import { beforeEach, describe, expect, it } from "vitest";
import { GUEST_TOOLS } from "@/server/ai/guest-tools";
import { createToolRunner } from "@/server/ai/run-tool";
import { createRoom } from "@/server/services/room-service";
import { createPlace, prisma, resetDatabase } from "./helpers";

// The guest concierge's place search, through the same tool runner the concierge uses and the real database: a
// region finds its towns, and a home's layout and amenities are filters, not guesses.

const runTool = createToolRunner(GUEST_TOOLS, null);
async function search(input: Record<string, unknown>) {
  const outcome = await runTool("search_places", input);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result as Array<{
    name: string;
    rooms: Array<{ name: string; bedrooms: number; bathrooms: number; amenities: string[] }>;
  }>;
}

/** A listed place in `area`, with a two-bedroom home that has a jacuzzi besides the helper's plain room. */
async function listedPlace(name: string, area: string) {
  const place = await createPlace(name);
  await prisma.business.update({ where: { id: place.business.id }, data: { area, listedPublicly: true } });
  await createRoom(place.ctx, {
    name: "Family home",
    capacity: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    baseRateCents: 15_000,
    minNights: 1,
    amenities: ["jacuzzi", "fireplace"],
  });
  return place;
}

beforeEach(async () => {
  await resetDatabase();
  await listedPlace("Beit Ehden", "Ehden");
  await listedPlace("Beit Chouf", "Chouf");
});

describe("concierge place search", () => {
  it("finds the towns of a region by its name, in English or Arabic", async () => {
    expect((await search({ area: "North Lebanon" })).map((place) => place.name)).toEqual(["Beit Ehden"]);
    expect((await search({ area: "الشمال" })).map((place) => place.name)).toEqual(["Beit Ehden"]);
    expect((await search({ area: "Chouf" })).map((place) => place.name)).toEqual(["Beit Chouf"]);
  });

  it("keeps only rooms with the bedrooms, bathrooms and amenities asked for, and shows their layout", async () => {
    const [place, ...others] = await search({
      area: "north",
      minBedrooms: 2,
      minBathrooms: 1,
      amenities: ["jacuzzi"],
    });
    expect(others).toEqual([]);
    expect(place!.rooms).toEqual([
      expect.objectContaining({
        name: "Family home",
        bedrooms: 2,
        bathrooms: 1,
        amenities: ["jacuzzi", "fireplace"],
      }),
    ]);
  });

  it("returns nothing rather than a near miss", async () => {
    expect(await search({ area: "North Lebanon", minBedrooms: 3 })).toEqual([]);
    expect(await search({ area: "North Lebanon", amenities: ["pool"] })).toEqual([]);
  });
});
