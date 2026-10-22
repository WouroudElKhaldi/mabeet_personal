import type { BookingStatus, ListingKind, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// Experiences and services, their sessions, and the bookings made on those sessions.
// Team queries always filter by businessId; public queries only return listed, active businesses.

const ACTIVE_STATUSES: BookingStatus[] = ["HELD", "CONFIRMED"];

const publicOfferingFields = {
  id: true,
  slug: true,
  kind: true,
  title: true,
  description: true,
  area: true,
  meetingPoint: true,
  latitude: true,
  longitude: true,
  durationMinutes: true,
  priceCents: true,
  priceUnit: true,
  maxGuests: true,
  minAge: true,
  activityLevel: true,
  skillLevel: true,
  included: true,
  notIncluded: true,
  accessibility: true,
  languages: true,
  tags: true,
  cancellationHours: true,
  category: { select: { slug: true, nameEn: true, nameAr: true } },
  photos: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      currency: true,
      depositPercent: true,
      whatsapp: true,
      timezone: true,
    },
  },
} satisfies Prisma.OfferingSelect;

const listedBusiness = { listedPublicly: true, status: "ACTIVE" } satisfies Prisma.BusinessWhereInput;

export interface OfferingFilters {
  kind?: ListingKind;
  categories?: string[];
  tags?: string[];
  accessibility?: string[];
  area?: string;
  text?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  guests?: number;
  /** Only offerings with a session starting inside this window. */
  from: Date;
  to?: Date;
}

function upcomingSessions(filters: Pick<OfferingFilters, "from" | "to">): Prisma.OfferingSessionWhereInput {
  return { active: true, startsAt: { gt: filters.from, ...(filters.to && { lt: filters.to }) } };
}

export function findListedOfferings(db: Db, filters: OfferingFilters, take: number) {
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  return db.offering.findMany({
    where: {
      active: true,
      kind: filters.kind ?? { in: ["EXPERIENCE", "SERVICE"] },
      business: listedBusiness,
      categorySlug: filters.categories?.length ? { in: filters.categories } : undefined,
      tags: filters.tags?.length ? { hasSome: filters.tags } : undefined,
      accessibility: filters.accessibility?.length ? { hasEvery: filters.accessibility } : undefined,
      area: filters.area ? contains(filters.area) : undefined,
      maxGuests: filters.guests ? { gte: filters.guests } : undefined,
      priceCents:
        filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined
          ? { gte: filters.minPriceCents, lte: filters.maxPriceCents }
          : undefined,
      OR: filters.text
        ? [
            { title: contains(filters.text) },
            { description: contains(filters.text) },
            { area: contains(filters.text) },
          ]
        : undefined,
      sessions: { some: upcomingSessions(filters) },
    },
    select: {
      ...publicOfferingFields,
      sessions: {
        where: upcomingSessions(filters),
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}

export function findPublicOffering(db: Db, slug: string) {
  return db.offering.findFirst({
    where: { slug, active: true, business: { status: "ACTIVE" } },
    select: { ...publicOfferingFields, description: true },
  });
}

/** Upcoming sessions of an offering with the seats still free in each. */
export async function listOpenSessions(db: Db, offeringId: string, from: Date, take: number) {
  const sessions = await db.offeringSession.findMany({
    where: { offeringId, active: true, startsAt: { gt: from } },
    orderBy: { startsAt: "asc" },
    take,
    select: { id: true, startsAt: true, endsAt: true, capacity: true },
  });
  const taken = await seatsTaken(
    db,
    sessions.map((session) => session.id),
  );
  return sessions.map((session) => ({
    ...session,
    seatsLeft: session.capacity - (taken.get(session.id) ?? 0),
  }));
}

async function seatsTaken(db: Db, sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db.sessionBooking.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: sessionIds }, status: { in: ACTIVE_STATUSES } },
    _sum: { seats: true },
  });
  return new Map(rows.map((row) => [row.sessionId, row._sum.seats ?? 0]));
}

// ---------- Team: offerings and sessions ----------

export function listOfferings(db: Db, businessId: string) {
  return db.offering.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    include: { category: { select: { nameEn: true, nameAr: true } } },
  });
}

export function findOffering(db: Db, businessId: string, offeringId: string) {
  return db.offering.findFirst({ where: { id: offeringId, businessId } });
}

export function createOffering(db: Db, data: Prisma.OfferingUncheckedCreateInput) {
  return db.offering.create({ data });
}

export async function updateOffering(
  db: Db,
  businessId: string,
  offeringId: string,
  data: Prisma.OfferingUncheckedUpdateManyInput,
) {
  const { count } = await db.offering.updateMany({ where: { id: offeringId, businessId }, data });
  return count > 0;
}

export function slugTaken(db: Db, slug: string) {
  return db.offering.count({ where: { slug } }).then((count) => count > 0);
}

export function createSessions(
  db: Db,
  sessions: Array<{ businessId: string; offeringId: string; startsAt: Date; endsAt: Date; capacity: number }>,
) {
  return db.offeringSession.createMany({ data: sessions });
}

export async function deactivateSession(db: Db, businessId: string, sessionId: string) {
  const { count } = await db.offeringSession.updateMany({
    where: { id: sessionId, businessId, active: true },
    data: { active: false },
  });
  return count > 0;
}

export function countActiveSessionBookings(db: Db, sessionId: string) {
  return db.sessionBooking.count({ where: { sessionId, status: { in: ACTIVE_STATUSES } } });
}

/** A business's sessions in a window, with how many seats are taken, for the schedule screen. */
export async function listBusinessSessions(db: Db, businessId: string, from: Date, to: Date) {
  const sessions = await db.offeringSession.findMany({
    where: { businessId, active: true, startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    include: { offering: { select: { id: true, title: true, kind: true } } },
  });
  const taken = await seatsTaken(
    db,
    sessions.map((session) => session.id),
  );
  return sessions.map((session) => ({ ...session, seatsTaken: taken.get(session.id) ?? 0 }));
}

// ---------- Session bookings ----------

/**
 * Locks an active, future session of an active offering for the rest of the transaction.
 * The seat trigger takes the same lock, so requests for the same session queue here.
 */
export async function lockOpenSession(tx: Prisma.TransactionClient, offeringId: string, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "OfferingSession" s
    JOIN "Offering" o ON o.id = s."offeringId"
    WHERE s.id = ${sessionId} AND s."offeringId" = ${offeringId} AND s.active AND o.active AND s."startsAt" > now()
    FOR UPDATE OF s`;
  return rows.length > 0;
}

export interface NewHeldSessionBooking {
  businessId: string;
  offeringId: string;
  sessionId: string;
  guestUserId: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  seats: number;
  totalCents: number;
  depositCents: number;
  currency: string;
  reference: string;
  publicToken: string;
  holdExpiresAt: Date;
  locale?: string;
}

export function createHeldSessionBooking(tx: Prisma.TransactionClient, booking: NewHeldSessionBooking) {
  return tx.sessionBooking.create({ data: { ...booking, status: "HELD" } });
}

const teamBookingInclude = {
  offering: { select: { id: true, title: true, kind: true } },
  session: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.SessionBookingInclude;

export function findSessionBooking(db: Db, businessId: string, bookingId: string) {
  return db.sessionBooking.findFirst({ where: { id: bookingId, businessId }, include: teamBookingInclude });
}

export function findSessionBookingByToken(db: Db, publicToken: string) {
  return db.sessionBooking.findUnique({
    where: { publicToken },
    include: {
      offering: {
        select: { title: true, kind: true, meetingPoint: true, durationMinutes: true, slug: true },
      },
      session: { select: { startsAt: true, endsAt: true } },
      business: {
        select: { name: true, slug: true, whatsapp: true, depositInstructions: true, timezone: true },
      },
      payments: true,
    },
  });
}

export function listSessionBookings(
  db: Db,
  businessId: string,
  filters: { status?: BookingStatus; take: number },
) {
  return db.sessionBooking.findMany({
    where: { businessId, status: filters.status },
    orderBy: { session: { startsAt: "asc" } },
    take: filters.take,
    include: teamBookingInclude,
  });
}

export function listGuestSessionBookings(db: Db, guestUserId: string) {
  return db.sessionBooking.findMany({
    where: { guestUserId },
    orderBy: { session: { startsAt: "desc" } },
    include: {
      offering: { select: { title: true, kind: true, slug: true } },
      session: { select: { startsAt: true, endsAt: true } },
      business: { select: { name: true, timezone: true } },
      review: { select: { id: true } },
    },
  });
}

export function changeSessionBookingStatus(
  tx: Prisma.TransactionClient,
  businessId: string,
  bookingId: string,
  change: { status: BookingStatus; decidedById?: string; cancelReason?: string },
) {
  return tx.sessionBooking.update({
    where: { id: bookingId, businessId },
    data: { ...change, decidedAt: change.decidedById ? new Date() : undefined },
  });
}

/** Expires unanswered session holds in one UPDATE that re-checks status. Returns the expired ids. */
export async function expireStaleSessionHolds(db: Db, now: Date): Promise<string[]> {
  const expired = await db.sessionBooking.updateManyAndReturn({
    where: { status: "HELD", holdExpiresAt: { lt: now } },
    data: { status: "EXPIRED" },
    select: { id: true },
  });
  return expired.map((booking) => booking.id);
}
