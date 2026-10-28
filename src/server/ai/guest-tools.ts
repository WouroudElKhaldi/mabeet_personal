import { z } from "zod";
import { AMENITIES } from "@/config/amenities";
import { ACCESSIBILITY, OFFERING_KINDS, TAGS } from "@/config/listing";
import { REGIONS } from "@/config/regions";
import { toDateRange } from "@/lib/dates";
import {
  checkAvailability,
  getOffering,
  getPlace,
  searchOfferings,
  searchPlaces,
} from "@/server/services/directory-service";
import { getHostSection } from "@/server/services/host-service";
import { defineTool } from "./tool";

// Public, read-only tools over listed places. They never return bookings, guests or anything unpublished.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const MAX_RESULTS = 5;

const placeUrl = (slug: string) => `/p/${slug}`;
const atLeast = (what: string) =>
  z.number().int().min(1).max(20).optional().describe(`At least this many ${what}`);

export const GUEST_TOOLS = [
  defineTool({
    name: "search_places",
    description:
      "Find guesthouses and homes in Lebanon that are free on the given dates. Turn every part of the guest's wish into a filter: area (a town, or a region such as North Lebanon), categories (mountain, beach, countryside, old-town, guesthouse, cabin, camping, vineyard, ski), bedrooms, bathrooms and beds, amenities (jacuzzi, pool, fireplace…), tags, accessibility and budget per night. Use free text only for what no filter covers. Each result lists its matching rooms with their layout and amenities.",
    input: z.object({
      checkIn: isoDate.optional(),
      checkOut: isoDate.optional(),
      guests: z.number().int().min(1).max(30).default(2),
      area: z
        .string()
        .max(60)
        .optional()
        .describe(`A town (Ehden, Batroun…) or a region: ${Object.keys(REGIONS).join(", ")}`),
      categories: z.array(z.string().max(40)).max(4).optional(),
      maxPricePerNight: z
        .number()
        .int()
        .min(1)
        .max(10_000)
        .optional()
        .describe("In the place's currency, usually USD"),
      minBedrooms: atLeast("bedrooms"),
      minBathrooms: atLeast("bathrooms"),
      minBeds: atLeast("beds"),
      amenities: z
        .array(z.enum(AMENITIES))
        .max(6)
        .optional()
        .describe("The room or home must have every one"),
      tags: z.array(z.enum(TAGS)).max(4).optional().describe("The place has at least one"),
      accessibility: z.array(z.enum(ACCESSIBILITY)).max(4).optional().describe("The place has every one"),
      text: z.string().max(120).optional().describe("Free words no filter covers, such as 'hiking'"),
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
        minBedrooms: input.minBedrooms,
        minBathrooms: input.minBathrooms,
        minBeds: input.minBeds,
        amenities: input.amenities,
        tags: input.tags,
        accessibility: input.accessibility,
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
        stayTotalCents: place.stayTotalFromCents,
        photoUrl: place.photo?.url ?? null,
        bookingLink: placeUrl(place.slug),
        rooms: place.offers.map((offer) => ({
          name: offer.name,
          sleeps: offer.capacity,
          bedrooms: offer.bedrooms,
          bathrooms: offer.bathrooms,
          beds: offer.beds,
          amenities: offer.amenities,
        })),
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
    description:
      "Public profile of one place: description, area, rooms, amenities, categories, rating, how to book and pay (instant or request, online or to the host), refund policy, whether it's booked as a whole, and its host.",
    input: z.object({ slug: z.string().max(64) }),
    mutates: false,
    run: async ({ slug }) => {
      const place = await getPlace(slug);
      const host = await getHostSection(place);
      return {
        slug: place.slug,
        name: place.name,
        area: place.area,
        description: place.description,
        currency: place.currency,
        checkIn: place.checkInTime,
        checkOut: place.checkOutTime,
        rating: place.rating,
        categories: place.categories.map(({ category }) => category.slug),
        bookedAs: place.bookingUnit === "WHOLE_PLACE" ? "the whole place" : "room by room",
        booking: place.bookingMode === "INSTANT" ? "instant" : "request, the host answers",
        payment:
          place.paymentCollection === "ONLINE"
            ? `online through Mabeet with Whish or a card (${place.onlineAmount === "FULL" ? "full amount" : "the deposit"})`
            : `to the host directly (deposit ${place.depositPercent}%)`,
        refundPolicy: place.refundPolicy,
        rooms: place.rooms.map((room) => ({
          name: room.name,
          capacity: room.capacity,
          nightlyRateCents: room.baseRateCents,
          amenities: room.amenities,
        })),
        roomsInsideWholePlace: place.showcaseRooms.map((room) => ({ name: room.name, beds: room.beds })),
        host: {
          name: host.name,
          yearsHosting: host.yearsHosting,
          languages: host.languages,
          responseRate: host.responseRate,
        },
        bookingLink: placeUrl(place.slug),
      };
    },
  }),
  defineTool({
    name: "search_experiences",
    description:
      "Find experiences (hikes, wine tastings, cooking classes, kayaking, workshops) or services (airport transfers, private chefs, local guides, photographers, massages) that still have spots on the given dates. Categories: hiking, food-wine, culture, water, workshops, transfers, private-chef, guides, photography, wellness.",
    input: z.object({
      kind: z.enum(OFFERING_KINDS).optional().describe("Leave out to search both"),
      from: isoDate.optional().describe("First day the guest is free"),
      to: isoDate.optional().describe("Day after the last day the guest is free"),
      guests: z.number().int().min(1).max(30).default(2),
      area: z.string().max(60).optional(),
      categories: z.array(z.string().max(40)).max(4).optional(),
      maxPricePerPerson: z.number().int().min(1).max(10_000).optional().describe("In the listing currency"),
      text: z.string().max(120).optional(),
    }),
    mutates: false,
    run: async (input) => {
      const range =
        input.from && input.to ? toDateRange({ checkIn: input.from, checkOut: input.to }) : undefined;
      const offerings = await searchOfferings({
        kind: input.kind,
        guests: input.guests,
        area: input.area,
        categories: input.categories,
        maxPriceCents: input.maxPricePerPerson && input.maxPricePerPerson * 100,
        text: input.text,
        range,
        limit: MAX_RESULTS,
      });
      return offerings.map((offering) => ({
        slug: offering.slug,
        kind: offering.kind,
        title: offering.title,
        area: offering.area,
        host: offering.hostName,
        category: offering.category?.slug ?? null,
        currency: offering.currency,
        priceCents: offering.priceCents,
        priceUnit: offering.priceUnit,
        durationMinutes: offering.durationMinutes,
        nextSession: offering.nextStartsAt,
        photoUrl: offering.photo?.url ?? null,
        bookingLink: `/o/${offering.slug}`,
      }));
    },
  }),
  defineTool({
    name: "get_experience",
    description:
      "One experience or service: what it includes, requirements, accessibility, meeting point and its next dates with spots left.",
    input: z.object({ slug: z.string().max(80) }),
    mutates: false,
    run: async ({ slug }) => {
      const offering = await getOffering(slug);
      return {
        slug: offering.slug,
        kind: offering.kind,
        title: offering.title,
        description: offering.description,
        area: offering.area,
        meetingPoint: offering.meetingPoint,
        durationMinutes: offering.durationMinutes,
        priceCents: offering.priceCents,
        priceUnit: offering.priceUnit,
        currency: offering.business.currency,
        maxGuests: offering.maxGuests,
        minAge: offering.minAge,
        activityLevel: offering.activityLevel,
        included: offering.included,
        notIncluded: offering.notIncluded,
        accessibility: offering.accessibility,
        languages: offering.languages,
        cancellationHoursBeforeStart: offering.cancellationHours,
        nextSessions: offering.sessions.slice(0, 10).map((session) => ({
          startsAt: session.startsAt,
          spotsLeft: session.seatsLeft,
        })),
        bookingLink: `/o/${offering.slug}`,
      };
    },
  }),
];
