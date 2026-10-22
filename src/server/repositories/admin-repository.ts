import type { BusinessStatus, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// Platform-wide reads for super admins only. Callers must check the platform role first.

export async function platformTotals(db: Db, since: Date) {
  const [businesses, users, bookings, recentBookings, confirmedByCurrency] = await Promise.all([
    db.business.count(),
    db.user.count(),
    db.booking.count(),
    db.booking.count({ where: { createdAt: { gte: since } } }),
    // Businesses price in different currencies, so revenue is summed per currency, never across them.
    db.booking.groupBy({
      by: ["currency"],
      where: { status: "CONFIRMED", createdAt: { gte: since } },
      _sum: { totalCents: true },
      orderBy: { currency: "asc" },
    }),
  ]);
  const recentConfirmed = confirmedByCurrency.map((row) => ({
    currency: row.currency,
    cents: row._sum.totalCents ?? 0,
  }));
  return { businesses, users, bookings, recentBookings, recentConfirmed };
}

export function listAllBusinesses(db: Db, take: number) {
  return db.business.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      area: true,
      status: true,
      listedPublicly: true,
      createdAt: true,
      _count: { select: { rooms: true, bookings: true, memberships: true } },
    },
  });
}

export async function setBusinessStatus(db: Db, businessId: string, status: BusinessStatus) {
  const { count } = await db.business.updateMany({ where: { id: businessId }, data: { status } });
  return count > 0;
}

export function listRecentUsers(db: Db, take: number) {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      createdAt: true,
      _count: { select: { memberships: true, bookings: true } },
    },
  });
}

export function listCategoriesWithUse(db: Db) {
  return db.category.findMany({
    orderBy: [{ kind: "asc" }, { position: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { businesses: true, offerings: true } } },
  });
}

export function createCategory(db: Db, data: Prisma.CategoryCreateInput) {
  return db.category.create({ data });
}

export async function updateCategory(db: Db, slug: string, data: Prisma.CategoryUpdateInput) {
  const { count } = await db.category.updateMany({ where: { slug }, data });
  return count > 0;
}

export function countCategoryUse(db: Db, slug: string) {
  return db.category.findUnique({
    where: { slug },
    select: { _count: { select: { businesses: true, offerings: true } } },
  });
}

export function deleteCategory(db: Db, slug: string) {
  return db.category.delete({ where: { slug } });
}

/** Calendar feeds that failed last time, or have not synced since `staleBefore`, across every business. */
export function listUnhealthyFeeds(db: Db, staleBefore: Date, take: number) {
  return db.calendarFeed.findMany({
    where: {
      OR: [
        { lastError: { not: null } },
        { lastSyncedAt: { lt: staleBefore } },
        { lastSyncedAt: null, createdAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }],
    take,
    select: {
      id: true,
      source: true,
      lastSyncedAt: true,
      lastError: true,
      business: { select: { id: true, name: true } },
      room: { select: { name: true } },
    },
  });
}

export function countFeeds(db: Db) {
  return db.calendarFeed.count();
}
