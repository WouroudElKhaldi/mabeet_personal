import type { BusinessStatus } from "@prisma/client";
import type { z } from "zod";
import type { Palette } from "@/config/appearance";
import { CATEGORY_ICONS } from "@/config/category-icons";
import { addDays } from "@/lib/dates";
import { prisma } from "@/server/db/client";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import * as admin from "@/server/repositories/admin-repository";
import { logActivity } from "@/server/repositories/activity-repository";
import { saveSitePalette } from "@/server/repositories/site-repository";
import type { categoryInput, categoryUpdate } from "@/server/validation/schemas";
import { getMonthlyAiUsage } from "./ai-usage-service";
import { duplicateAsConflict } from "./constraint-errors";

export interface PlatformActor {
  id: string;
  platformRole: string;
}

export function requireSuperAdmin(actor: PlatformActor): void {
  if (actor.platformRole !== "SUPER_ADMIN") throw forbidden("Platform admins only");
}

export async function getPlatformOverview(actor: PlatformActor, now = new Date()) {
  requireSuperAdmin(actor);
  const [totals, businesses, users] = await Promise.all([
    admin.platformTotals(prisma, addDays(now, -30)),
    admin.listAllBusinesses(prisma, 100),
    admin.listRecentUsers(prisma, 50),
  ]);
  return { totals, businesses, users };
}

/** Suspending hides a business everywhere at once: its page, its search listing, its team access and its keys. */
export async function setBusinessStatus(actor: PlatformActor, businessId: string, status: BusinessStatus) {
  requireSuperAdmin(actor);
  if (!(await admin.setBusinessStatus(prisma, businessId, status))) throw notFound("Business");
  await logActivity(prisma, {
    userId: actor.id,
    businessId,
    action: `platform.business_${status.toLowerCase()}`,
    entity: "business",
    entityId: businessId,
  });
}

/** The website's colour palette is a platform decision; visitors only choose light or dark. Logged like every admin action. */
export async function setSitePalette(actor: PlatformActor, palette: Palette) {
  requireSuperAdmin(actor);
  await saveSitePalette(prisma, palette, actor.id);
  await logActivity(prisma, {
    userId: actor.id,
    action: "platform.palette_changed",
    entity: "site",
    entityId: "site",
    meta: { palette },
  });
}

export function listCategoriesForAdmin(actor: PlatformActor) {
  requireSuperAdmin(actor);
  return admin.listCategoriesWithUse(prisma);
}

function assertKnownIcon(icon: string | undefined) {
  if (icon !== undefined && !(CATEGORY_ICONS as readonly string[]).includes(icon))
    throw invalid(`Unknown icon: ${icon}`);
}

export async function createCategory(actor: PlatformActor, input: z.infer<typeof categoryInput>) {
  requireSuperAdmin(actor);
  assertKnownIcon(input.icon);
  await duplicateAsConflict("A category with this slug already exists", () =>
    admin.createCategory(prisma, input),
  );
  await logPlatform(actor, "platform.category_created", input.slug);
}

export async function updateCategory(
  actor: PlatformActor,
  slug: string,
  input: z.infer<typeof categoryUpdate>,
) {
  requireSuperAdmin(actor);
  assertKnownIcon(input.icon);
  if (!(await admin.updateCategory(prisma, slug, input))) throw notFound("Category");
  await logPlatform(actor, "platform.category_updated", slug);
}

/** A category still used by places or experiences cannot go: they would silently lose it. */
export async function deleteCategory(actor: PlatformActor, slug: string) {
  requireSuperAdmin(actor);
  const use = await admin.countCategoryUse(prisma, slug);
  if (!use) throw notFound("Category");
  if (use._count.businesses + use._count.offerings > 0) {
    throw conflict("Places or experiences still use this category. Move them first.");
  }
  await admin.deleteCategory(prisma, slug);
  await logPlatform(actor, "platform.category_deleted", slug);
}

function logPlatform(actor: PlatformActor, action: string, entityId: string) {
  return logActivity(prisma, { userId: actor.id, action, entity: "category", entityId });
}

/** Feeds sync every 15 minutes; two hours without a sync means something is wrong. */
const FEED_STALE_MS = 2 * 60 * 60_000;

/** Calendar sync across the platform: how many feeds, and the ones failing or stuck. */
export async function getSyncHealth(actor: PlatformActor, now = new Date()) {
  requireSuperAdmin(actor);
  const [total, unhealthy] = await Promise.all([
    admin.countFeeds(prisma),
    admin.listUnhealthyFeeds(prisma, new Date(now.getTime() - FEED_STALE_MS), 50),
  ]);
  return { total, unhealthy };
}

export function getAiUsage(actor: PlatformActor, now = new Date()) {
  requireSuperAdmin(actor);
  return getMonthlyAiUsage(now);
}
