import type { Db } from "@/server/db/client";

// Everything held about one person, for "download my data", and the checks before deleting an account.

export function findMyData(db: Db, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      locale: true,
      createdAt: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          status: true,
          checkIn: true,
          checkOut: true,
          guestCount: true,
          guestName: true,
          guestPhone: true,
          guestEmail: true,
          guestNote: true,
          totalCents: true,
          depositCents: true,
          currency: true,
          createdAt: true,
          business: { select: { name: true } },
          room: { select: { name: true } },
        },
      },
      sessionBookings: {
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          status: true,
          seats: true,
          guestName: true,
          guestPhone: true,
          guestEmail: true,
          guestNote: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          offering: { select: { title: true } },
          session: { select: { startsAt: true } },
          business: { select: { name: true } },
        },
      },
      reviews: {
        select: { rating: true, comment: true, createdAt: true, business: { select: { name: true } } },
      },
      favorites: { select: { createdAt: true, business: { select: { name: true } } } },
      memberships: {
        select: {
          status: true,
          createdAt: true,
          business: { select: { name: true } },
          role: { select: { name: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        select: { action: true, entity: true, createdAt: true },
      },
    },
  });
}

/** Active businesses where this person is the only active owner: deleting them would orphan the place. */
export async function listSoleOwnedBusinesses(db: Db, userId: string): Promise<string[]> {
  const owned = await db.membership.findMany({
    where: { userId, status: "ACTIVE", role: { isOwner: true }, business: { status: "ACTIVE" } },
    select: { businessId: true, business: { select: { name: true } } },
  });
  const sole: string[] = [];
  for (const membership of owned) {
    const owners = await db.membership.count({
      where: { businessId: membership.businessId, status: "ACTIVE", role: { isOwner: true } },
    });
    if (owners === 1) sole.push(membership.business.name);
  }
  return sole;
}

/**
 * Deletes the person. Sessions, sign-in accounts, favourites, memberships and keys go with them (cascades);
 * their reviews stay without a name and their bookings stay with the host without the account link.
 */
export function deleteUser(db: Db, userId: string) {
  return db.user.delete({ where: { id: userId } });
}

export function setLocale(db: Db, userId: string, locale: string) {
  return db.user.update({ where: { id: userId }, data: { locale }, select: { id: true } });
}

export function findProfile(db: Db, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, locale: true, notificationsSeenAt: true },
  });
}

export function updateProfile(db: Db, userId: string, data: { name: string; phone: string | null }) {
  return db.user.update({ where: { id: userId }, data, select: { id: true } });
}

export function markNotificationsSeen(db: Db, userId: string, at: Date) {
  return db.user.update({ where: { id: userId }, data: { notificationsSeenAt: at }, select: { id: true } });
}
