import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

export interface ActivityEntry {
  userId?: string | null;
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

export function logActivity(db: Db, entry: ActivityEntry) {
  return db.activityLog.create({ data: entry });
}

export function listUserActivity(db: Db, userId: string, take: number) {
  return db.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { business: { select: { name: true, slug: true } } },
  });
}

/** Where a feed reads from: one business, or the whole platform (admins). */
export type FeedScope = { businessId: string } | { platform: true };

const scopeWhere = (scope: FeedScope) => ("businessId" in scope ? { businessId: scope.businessId } : {});

/** The newest notable events, with who did it and, for bookings, the guest and reference. */
export async function listFeed(db: Db, scope: FeedScope, actions: readonly string[], take: number) {
  const rows = await db.activityLog.findMany({
    where: { ...scopeWhere(scope), action: { in: [...actions] } },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { name: true } },
      business: { select: { id: true, name: true } },
    },
  });
  const ids = rows.map((row) => row.entityId).filter((id): id is string => Boolean(id));
  const [stays, seats] = await Promise.all([
    db.booking.findMany({
      where: { id: { in: ids } },
      select: { id: true, reference: true, guestName: true },
    }),
    db.sessionBooking.findMany({
      where: { id: { in: ids } },
      select: { id: true, reference: true, guestName: true },
    }),
  ]);
  const bookings = new Map([...stays, ...seats].map((booking) => [booking.id, booking]));
  return rows.map((row) => ({ ...row, booking: row.entityId ? (bookings.get(row.entityId) ?? null) : null }));
}

/** How many notable events arrived since a moment, not counting the person's own. */
export function countFeedSince(
  db: Db,
  scope: FeedScope,
  actions: readonly string[],
  since: Date | null,
  excludeUserId: string,
) {
  return db.activityLog.count({
    where: {
      ...scopeWhere(scope),
      action: { in: [...actions] },
      createdAt: since ? { gt: since } : undefined,
      OR: [{ userId: null }, { userId: { not: excludeUserId } }],
    },
  });
}
