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

/** The host a guest sees on a place or experience page: an owner who chose to be shown. */
export async function findPublicHost(db: Db, businessId: string) {
  const membership = await db.membership.findFirst({
    where: { businessId, ...ownerOf, user: { hostProfile: { showOnListings: true } } },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { name: true, createdAt: true, hostProfile: true } } },
  });
  return membership?.user ?? null;
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
