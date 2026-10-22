import { cache } from "react";
import { type DateRange, toIsoDate } from "@/lib/dates";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as directory from "@/server/repositories/directory-repository";
import * as offeringsRepo from "@/server/repositories/offering-repository";
import { quoteStay } from "./pricing";

// The public face of every listed place. The web search page, the guest AI chat and the guest MCP
// all call these functions, so they always agree with each other and with the booking page.

export interface SearchQuery extends directory.DirectoryFilters {
  range?: DateRange;
  limit: number;
}

type PublicPlace = Awaited<ReturnType<typeof directory.findPlacesByIds>>[number];
type PublicRoom = PublicPlace["rooms"][number];

interface RoomOffer {
  roomId: string;
  name: string;
  capacity: number;
  nightlyFromCents: number;
  stayTotalCents: number | null;
}

async function overridesByRoom(roomIds: string[], range: DateRange) {
  const rows = await directory.findRateOverridesForRooms(prisma, roomIds, range);
  const byRoom = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const rates = byRoom.get(row.roomId) ?? new Map<string, number>();
    rates.set(toIsoDate(row.date), row.rateCents);
    byRoom.set(row.roomId, rates);
  }
  return byRoom;
}

/** Free rooms with their price for the stay; without dates every active room is an offer at its base rate. */
async function offersFor(
  rooms: PublicRoom[],
  range: DateRange | undefined,
  depositPercent: number,
): Promise<RoomOffer[]> {
  if (!range) {
    return rooms.map((room) => ({
      roomId: room.id,
      name: room.name,
      capacity: room.capacity,
      nightlyFromCents: room.baseRateCents,
      stayTotalCents: null,
    }));
  }
  const roomIds = rooms.map((room) => room.id);
  const [taken, overrides] = await Promise.all([
    directory.findTakenRoomIds(prisma, roomIds, range),
    overridesByRoom(roomIds, range),
  ]);
  return rooms
    .filter((room) => !taken.has(room.id))
    .map((room) => {
      const quote = quoteStay({
        range,
        baseRateCents: room.baseRateCents,
        overrides: overrides.get(room.id) ?? new Map(),
        depositPercent,
      });
      return {
        roomId: room.id,
        name: room.name,
        capacity: room.capacity,
        nightlyFromCents: Math.min(...quote.nights.map((night) => night.rateCents)),
        stayTotalCents: quote.totalCents,
      };
    });
}

function toCard(
  place: PublicPlace,
  offers: RoomOffer[],
  rating: { average: number; count: number } | undefined,
) {
  return {
    slug: place.slug,
    name: place.name,
    area: place.area,
    currency: place.currency,
    photo: place.photos[0] ?? place.rooms.flatMap((room) => room.photos)[0] ?? null,
    categories: place.categories.map(({ category }) => category),
    rating: rating ?? { average: 0, count: 0 },
    nightlyFromCents: offers.length > 0 ? Math.min(...offers.map((offer) => offer.nightlyFromCents)) : null,
    offers,
  };
}

export type PlaceCard = ReturnType<typeof toCard>;

export async function searchPlaces(query: SearchQuery): Promise<PlaceCard[]> {
  const places = await directory.findListedPlaces(prisma, query, query.limit * 3);
  const ratings = await directory.findRatingSummaries(
    prisma,
    places.map((place) => place.id),
  );
  const cards = await Promise.all(
    places.map(async (place) => {
      const offers = await offersFor(place.rooms, query.range, place.depositPercent);
      return offers.length > 0 ? toCard(place, offers, ratings.get(place.id)) : null;
    }),
  );
  return cards.filter((card): card is PlaceCard => card !== null).slice(0, query.limit);
}

/** Cached per request: the page and its metadata share one lookup. */
export const getPlace = cache(async (slug: string) => {
  const place = await directory.findPublicPlace(prisma, slug);
  if (!place) throw notFound("Place");
  const ratings = await directory.findRatingSummaries(prisma, [place.id]);
  return { ...place, rating: ratings.get(place.id) ?? { average: 0, count: 0 } };
});

export async function checkAvailability(slug: string, range: DateRange) {
  const place = await getPlace(slug);
  const offers = await offersFor(place.rooms, range, place.depositPercent);
  const free = new Set(offers.map((offer) => offer.roomId));
  return {
    place: { slug: place.slug, name: place.name, currency: place.currency },
    checkIn: toIsoDate(range.checkIn),
    checkOut: toIsoDate(range.checkOut),
    rooms: place.rooms.map((room) => ({
      roomId: room.id,
      name: room.name,
      free: free.has(room.id),
      stayTotalCents: offers.find((offer) => offer.roomId === room.id)?.stayTotalCents ?? null,
    })),
  };
}

/** Price breakdown for one room and stay, plus whether it is still free. Shown before a guest requests. */
export async function quoteRoom(slug: string, roomId: string, range: DateRange) {
  const place = await getPlace(slug);
  const room = place.rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw notFound("Room");
  const [taken, overrides] = await Promise.all([
    directory.findTakenRoomIds(prisma, [room.id], range),
    overridesByRoom([room.id], range),
  ]);
  const quote = quoteStay({
    range,
    baseRateCents: room.baseRateCents,
    overrides: overrides.get(room.id) ?? new Map(),
    depositPercent: place.depositPercent,
  });
  return { free: !taken.has(room.id), currency: place.currency, minNights: room.minNights, ...quote };
}

/** Taken nights for a room's public calendar. */
export async function getTakenNights(slug: string, roomId: string, range: DateRange) {
  const place = await getPlace(slug);
  if (!place.rooms.some((room) => room.id === roomId)) throw notFound("Room");
  const ranges = await directory.findTakenRanges(prisma, roomId, range);
  return ranges.map((taken) => ({ checkIn: toIsoDate(taken.checkIn), checkOut: toIsoDate(taken.checkOut) }));
}

export function listCategories() {
  return directory.listCategories(prisma);
}

export async function getPlacesByIds(businessIds: string[]) {
  const places = await directory.findPlacesByIds(prisma, businessIds);
  const ratings = await directory.findRatingSummaries(prisma, businessIds);
  return Promise.all(
    places.map(async (place) =>
      toCard(place, await offersFor(place.rooms, undefined, place.depositPercent), ratings.get(place.id)),
    ),
  );
}

// ---------- Experiences and services ----------

export interface OfferingQuery extends Omit<offeringsRepo.OfferingFilters, "from" | "to"> {
  range?: DateRange;
  limit: number;
}

type ListedOffering = Awaited<ReturnType<typeof offeringsRepo.findListedOfferings>>[number];

const NO_RATING = { average: 0, count: 0 };

function toOfferingCard(offering: ListedOffering, rating = NO_RATING) {
  return {
    id: offering.id,
    slug: offering.slug,
    kind: offering.kind,
    title: offering.title,
    area: offering.area,
    currency: offering.business.currency,
    hostName: offering.business.name,
    photo: offering.photos[0] ?? null,
    category: offering.category,
    tags: offering.tags,
    priceCents: offering.priceCents,
    priceUnit: offering.priceUnit,
    durationMinutes: offering.durationMinutes,
    nextStartsAt: offering.sessions[0]?.startsAt ?? null,
    timezone: offering.business.timezone,
    rating,
  };
}

export type OfferingCard = ReturnType<typeof toOfferingCard>;

/** Listed experiences or services that still have a session coming up (inside the dates, when given). */
export async function searchOfferings(query: OfferingQuery, now = new Date()): Promise<OfferingCard[]> {
  const { range, limit, ...filters } = query;
  const from = range && range.checkIn > now ? range.checkIn : now;
  const rows = await offeringsRepo.findListedOfferings(
    prisma,
    { ...filters, from, to: range?.checkOut },
    limit,
  );
  const ratings = await directory.findOfferingRatingSummaries(
    prisma,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toOfferingCard(row, ratings.get(row.id)));
}

const SESSIONS_SHOWN = 40;

/** One experience or service with its upcoming sessions and seats left. Cached per request. */
export const getOffering = cache(async (slug: string, now = new Date()) => {
  const offering = await offeringsRepo.findPublicOffering(prisma, slug);
  if (!offering) throw notFound("Experience");
  const [sessions, ratings] = await Promise.all([
    offeringsRepo.listOpenSessions(prisma, offering.id, now, SESSIONS_SHOWN),
    directory.findOfferingRatingSummaries(prisma, [offering.id]),
  ]);
  return { ...offering, sessions, rating: ratings.get(offering.id) ?? NO_RATING };
});
