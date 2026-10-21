import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as favorites from "@/server/repositories/favorite-repository";
import { getPlacesByIds } from "./directory-service";

async function requirePlaceId(slug: string) {
  const businessId = await favorites.findPlaceIdBySlug(prisma, slug);
  if (!businessId) throw notFound("Place");
  return businessId;
}

export async function setFavorite(userId: string, slug: string, favorite: boolean) {
  const businessId = await requirePlaceId(slug);
  if (favorite) await favorites.addFavorite(prisma, userId, businessId);
  else await favorites.removeFavorite(prisma, userId, businessId);
  await logActivity(prisma, {
    userId,
    businessId,
    action: favorite ? "favorite.added" : "favorite.removed",
    entity: "place",
    entityId: businessId,
  });
}

export async function listFavoritePlaces(userId: string) {
  return getPlacesByIds(await favorites.listFavoriteBusinessIds(prisma, userId));
}

/** Slugs the user saved, for drawing filled hearts. Empty for signed-out visitors. */
export function favoriteSlugs(userId: string | undefined): Promise<Set<string>> {
  return userId ? favorites.listFavoriteSlugs(prisma, userId) : Promise.resolve(new Set());
}
