import type { Prisma } from "@prisma/client";
import type { DateRange } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { overlapsRange } from "./filters";

// Reads across tenants for the public directory. Only businesses that opted in, and only public fields.

const publicRoomFields = {
  id: true,
  name: true,
  description: true,
  capacity: true,
  bedrooms: true,
  beds: true,
  bathrooms: true,
  baseRateCents: true,
  minNights: true,
  amenities: true,
  photos: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
} satisfies Prisma.RoomSelect;

const publicPlaceFields = {
  id: true,
  slug: true,
  name: true,
  description: true,
  area: true,
  latitude: true,
  longitude: true,
  currency: true,
  checkInTime: true,
  checkOutTime: true,
  houseRules: true,
  cancellationPolicy: true,
  depositPercent: true,
  bookingMode: true,
  paymentCollection: true,
  onlineAmount: true,
  refundPolicy: true,
  whatsapp: true,
  tags: true,
  accessibility: true,
  minGuestAge: true,
  address: true,
  photos: {
    where: { roomId: null, offeringId: null },
    orderBy: { position: "asc" },
    select: { url: true, alt: true },
  },
  categories: { select: { category: { select: { slug: true, nameEn: true, nameAr: true, icon: true } } } },
} satisfies Prisma.BusinessSelect;

export interface DirectoryFilters {
  guests: number;
  area?: string;
  categories?: string[];
  minRateCents?: number;
  maxRateCents?: number;
  text?: string;
  /** A room must offer every one of these. */
  amenities?: string[];
  /** The place has at least one of these tags. */
  tags?: string[];
  /** The place has every one of these accessibility features. */
  accessibility?: string[];
}

function listedPlaces(filters: DirectoryFilters): Prisma.BusinessWhereInput {
  return {
    listedPublicly: true,
    status: "ACTIVE",
    tags: filters.tags?.length ? { hasSome: filters.tags } : undefined,
    accessibility: filters.accessibility?.length ? { hasEvery: filters.accessibility } : undefined,
    area: filters.area ? { contains: filters.area, mode: "insensitive" } : undefined,
    categories: filters.categories?.length
      ? { some: { categorySlug: { in: filters.categories } } }
      : undefined,
    OR: filters.text
      ? [
          { name: { contains: filters.text, mode: "insensitive" } },
          { description: { contains: filters.text, mode: "insensitive" } },
          { area: { contains: filters.text, mode: "insensitive" } },
          { rooms: { some: { amenities: { has: filters.text.toLowerCase() } } } },
        ]
      : undefined,
  };
}

function matchingRooms(filters: DirectoryFilters): Prisma.RoomWhereInput {
  return {
    active: true,
    capacity: { gte: filters.guests },
    baseRateCents:
      filters.minRateCents === undefined && filters.maxRateCents === undefined
        ? undefined
        : { gte: filters.minRateCents, lte: filters.maxRateCents },
    amenities: filters.amenities?.length ? { hasEvery: filters.amenities } : undefined,
  };
}

export function findListedPlaces(db: Db, filters: DirectoryFilters, take: number) {
  const rooms = matchingRooms(filters);
  return db.business.findMany({
    where: { ...listedPlaces(filters), rooms: { some: rooms } },
    select: { ...publicPlaceFields, rooms: { where: rooms, select: publicRoomFields } },
    take,
    orderBy: { createdAt: "asc" },
  });
}

/** A place page is reachable by its link even when the owner has not listed it in search. */
export function findPublicPlace(db: Db, slug: string) {
  return db.business.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      ...publicPlaceFields,
      listedPublicly: true,
      rooms: { where: { active: true }, select: publicRoomFields },
    },
  });
}

export function findPlacesByIds(db: Db, businessIds: string[]) {
  return db.business.findMany({
    where: { id: { in: businessIds }, status: "ACTIVE" },
    select: { ...publicPlaceFields, rooms: { where: { active: true }, select: publicRoomFields } },
  });
}

/** Room ids with any active occupancy (any source) overlapping the range. */
export async function findTakenRoomIds(db: Db, roomIds: string[], range: DateRange): Promise<Set<string>> {
  const taken = await db.occupancy.findMany({
    where: { roomId: { in: roomIds }, active: true, ...overlapsRange(range) },
    select: { roomId: true },
    distinct: ["roomId"],
  });
  return new Set(taken.map((row) => row.roomId));
}

/** Taken nights of one room inside a range, without saying why (no guest or source details). */
export function findTakenRanges(db: Db, roomId: string, range: DateRange) {
  return db.occupancy.findMany({
    where: { roomId, active: true, ...overlapsRange(range) },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: "asc" },
  });
}

export function findRateOverridesForRooms(db: Db, roomIds: string[], range: DateRange) {
  return db.rateOverride.findMany({
    where: { roomId: { in: roomIds }, date: { gte: range.checkIn, lt: range.checkOut } },
    select: { roomId: true, date: true, rateCents: true },
  });
}

export async function findRatingSummaries(db: Db, businessIds: string[]) {
  const rows = await db.review.groupBy({
    by: ["businessId"],
    where: { businessId: { in: businessIds }, offeringId: null, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((row) => [row.businessId, { average: row._avg.rating ?? 0, count: row._count._all }]),
  );
}

export async function findOfferingRatingSummaries(db: Db, offeringIds: string[]) {
  const rows = await db.review.groupBy({
    by: ["offeringId"],
    where: { offeringId: { in: offeringIds }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((row) => [row.offeringId ?? "", { average: row._avg.rating ?? 0, count: row._count._all }]),
  );
}

export function listCategories(db: Db) {
  return db.category.findMany({ orderBy: [{ position: "asc" }, { nameEn: "asc" }] });
}
