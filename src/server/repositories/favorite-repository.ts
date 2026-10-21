import type { Db } from "@/server/db/client";

// A signed-in guest's favourite places.

export function listFavoriteBusinessIds(db: Db, userId: string) {
  return db.favorite
    .findMany({ where: { userId }, select: { businessId: true }, orderBy: { createdAt: "desc" } })
    .then((rows) => rows.map((row) => row.businessId));
}

export function addFavorite(db: Db, userId: string, businessId: string) {
  return db.favorite.upsert({
    where: { userId_businessId: { userId, businessId } },
    create: { userId, businessId },
    update: {},
  });
}

export function removeFavorite(db: Db, userId: string, businessId: string) {
  return db.favorite.deleteMany({ where: { userId, businessId } });
}

export function findPlaceIdBySlug(db: Db, slug: string) {
  return db.business
    .findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } })
    .then((place) => place?.id ?? null);
}

export function listFavoriteSlugs(db: Db, userId: string) {
  return db.favorite
    .findMany({ where: { userId }, select: { business: { select: { slug: true } } } })
    .then((rows) => new Set(rows.map((row) => row.business.slug)));
}
