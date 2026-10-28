import { describe, expect, it, vi } from "vitest";

// The concierge's cards come from its tool results. A model that searches twice must not show a place twice.

const place = (slug: string, stayTotalCents: number | null) => ({
  slug,
  name: slug,
  area: "Faraya",
  currency: "USD",
  stayTotalCents,
  nightlyFromCents: 9_000,
  photoUrl: null,
  bookingLink: `/places/${slug}`,
});

vi.mock("@/server/ai/assistant", () => ({
  runAssistant: vi.fn(async () => ({
    reply: "Two lodges are free.",
    usage: { promptTokens: 1, completionTokens: 1 },
    proposals: [],
    trace: [
      {
        tool: "search_places",
        outcome: { ok: true, result: [place("snow-lodge", null), place("cabin", null)] },
      },
      { tool: "search_places", outcome: { ok: true, result: [place("snow-lodge", 42_000)] } },
    ],
  })),
}));
vi.mock("@/server/services/ai-usage-service", () => ({
  assertWithinBudget: vi.fn(async () => undefined),
  recordAiUsage: vi.fn(),
}));

const { askConcierge } = await import("@/server/services/assistant-service");

describe("concierge cards", () => {
  it("shows a place found by two searches once, with the latest search's price", async () => {
    const { places } = await askConcierge([{ role: "user", content: "a lodge in Faraya" }]);
    expect(places.map((card) => card.slug)).toEqual(["snow-lodge", "cabin"]);
    expect(places[0]).toMatchObject({ priceCents: 42_000, priceUnit: "stay" });
  });
});
