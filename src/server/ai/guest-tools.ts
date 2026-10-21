import { z } from "zod";
import { toDateRange } from "@/lib/dates";
import { checkAvailability, getPlace, searchPlaces } from "@/server/services/directory-service";
import { defineTool } from "./tool";

// Public, read-only tools over listed places. They never return bookings, guests or anything unpublished.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const MAX_RESULTS = 5;

const placeUrl = (slug: string) => `/p/${slug}`;

export const GUEST_TOOLS = [
  defineTool({
    name: "search_places",
    description:
      "Find guesthouses in Lebanon that are free on the given dates. Turn the guest's wish into filters: area, categories (mountain, beach, countryside, old-town, guesthouse, cabin, camping, vineyard, ski), budget per night and free text.",
    input: z.object({
      checkIn: isoDate.optional(),
      checkOut: isoDate.optional(),
      guests: z.number().int().min(1).max(30).default(2),
      area: z.string().max(60).optional(),
      categories: z.array(z.string().max(40)).max(4).optional(),
      maxPricePerNight: z
        .number()
        .int()
        .min(1)
        .max(10_000)
        .optional()
        .describe("In the place's currency, usually USD"),
      text: z.string().max(120).optional().describe("Free words such as 'hiking' or 'fireplace'"),
    }),
    mutates: false,
    run: async (input) => {
      const range =
        input.checkIn && input.checkOut
          ? toDateRange({ checkIn: input.checkIn, checkOut: input.checkOut })
          : undefined;
      const places = await searchPlaces({
        guests: input.guests,
        area: input.area,
        categories: input.categories,
        maxRateCents: input.maxPricePerNight && input.maxPricePerNight * 100,
        text: input.text,
        range,
        limit: MAX_RESULTS,
      });
      return places.map((place) => ({
        slug: place.slug,
        name: place.name,
        area: place.area,
        categories: place.categories.map((category) => category.slug),
        rating: place.rating,
        currency: place.currency,
        nightlyFromCents: place.nightlyFromCents,
        stayTotalCents: place.offers[0]?.stayTotalCents ?? null,
        bookingLink: placeUrl(place.slug),
      }));
    },
  }),
  defineTool({
    name: "check_availability",
    description:
      "Is a specific place free on given dates? Returns each room as free or taken, with the price for the stay.",
    input: z.object({ slug: z.string().max(64), checkIn: isoDate, checkOut: isoDate }),
    mutates: false,
    run: async ({ slug, checkIn, checkOut }) => ({
      ...(await checkAvailability(slug, toDateRange({ checkIn, checkOut }))),
      bookingLink: placeUrl(slug),
    }),
  }),
  defineTool({
    name: "get_place",
    description: "Public profile of one place: description, area, rooms, amenities, categories and rating.",
    input: z.object({ slug: z.string().max(64) }),
    mutates: false,
    run: async ({ slug }) => {
      const place = await getPlace(slug);
      return {
        slug: place.slug,
        name: place.name,
        area: place.area,
        description: place.description,
        checkIn: place.checkInTime,
        checkOut: place.checkOutTime,
        rating: place.rating,
        categories: place.categories.map(({ category }) => category.slug),
        rooms: place.rooms.map((room) => ({
          name: room.name,
          capacity: room.capacity,
          nightlyRateCents: room.baseRateCents,
          amenities: room.amenities,
        })),
        bookingLink: placeUrl(place.slug),
      };
    },
  }),
];
