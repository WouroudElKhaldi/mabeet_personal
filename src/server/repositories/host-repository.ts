import type { Db } from "@/server/db/client";

// Hosts: the people who own businesses, and their own profile. A host is a user with an active owner
// membership; the profile is theirs, not a business's, so one host with five places has one profile.

const ownerOf = { status: "ACTIVE", role: { isOwner: true } } as const;

export function findHostProfile(db: Db, userId: string) {
  return db.hostProfile.findUnique({ where: { userId } });
}

export interface HostProfileFields {
  displayName: string | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  languages: string[];
  hostingSince: number | null;
  showOnListings: boolean;
}

export function saveHostProfile(db: Db, userId: string, fields: HostProfileFields) {
  return db.hostProfile.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
}

const hostBusinesses = {
  memberships: {
    where: ownerOf,
    select: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          area: true,
          status: true,
          plan: true,
          listedPublicly: true,
          createdAt: true,
          _count: { select: { rooms: true, offerings: true, bookings: true, memberships: true } },
        },
      },
    },
  },
} as const;

/** The place's first owner: their profile (shown or not, the service decides) and when they joined. */
export async function findPlaceOwner(db: Db, businessId: string) {
  const membership = await db.membership.findFirst({
    where: { businessId, ...ownerOf },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { name: true, createdAt: true, hostProfile: true } } },
  });
  return membership?.user ?? null;
}

/**
 * How a place answers requests over the last year: how many it got, how many it answered (confirmed,
 * accepted or declined rather than left to expire), and the median minutes to answer.
 */
export async function responseStats(db: Db, businessId: string, since: Date) {
  const [row] = await db.$queryRaw<Array<{ total: number; answered: number; minutes: number | null }>>`
    SELECT COUNT(*)::int AS total,
           COUNT("decidedAt")::int AS answered,
           (percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("decidedAt" - "createdAt")) / 60
           ) FILTER (WHERE "decidedAt" IS NOT NULL))::int AS minutes
    FROM "Booking"
    WHERE "businessId" = ${businessId} AND "createdAt" >= ${since}
      AND ("decidedAt" IS NOT NULL OR status = 'EXPIRED')`;
  return row ?? { total: 0, answered: 0, minutes: null };
}

/** Every person who owns at least one business, with their businesses. */
export function listHosts(db: Db) {
  return db.user.findMany({
    where: { memberships: { some: ownerOf } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      hostProfile: { select: { phone: true, city: true, showOnListings: true } },
      ...hostBusinesses,
    },
  });
}

export function findHost(db: Db, userId: string) {
  return db.user.findFirst({
    where: { id: userId, memberships: { some: ownerOf } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
      hostProfile: true,
      ...hostBusinesses,
    },
  });
}
