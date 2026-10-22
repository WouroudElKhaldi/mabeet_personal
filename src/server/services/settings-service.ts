import type { z } from "zod";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { invalid } from "@/server/errors";
import { findBusinessSettings, updateBusinessSettings } from "@/server/repositories/business-repository";
import { listCategories } from "@/server/repositories/directory-repository";
import type { settingsInput } from "@/server/validation/schemas";
import { recordAction } from "./audit";
import { ensureWholePlaceUnit } from "./room-service";

export function getSettings(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  return findBusinessSettings(prisma, ctx.businessId);
}

/** A place picks from the platform's home categories; an unknown slug is a 400, not a foreign-key crash. */
async function assertKnownCategories(slugs: readonly string[]) {
  const homes = (await listCategories(prisma)).filter((category) => category.kind === "HOME");
  const known = new Set(homes.map((category) => category.slug));
  const unknown = slugs.filter((slug) => !known.has(slug));
  if (unknown.length > 0) throw invalid(`Unknown categories: ${unknown.join(", ")}`);
}

export async function updateSettings(ctx: TenantContext, input: z.infer<typeof settingsInput>) {
  requirePermission(ctx, "settings.manage");
  const { categories, ...fields } = input;
  if (categories) await assertKnownCategories(categories);
  // Booked as a whole: the place needs its whole-place unit before guests can book it.
  if (fields.bookingUnit === "WHOLE_PLACE") {
    const { name } = await findBusinessSettings(prisma, ctx.businessId);
    await ensureWholePlaceUnit(ctx, fields.name ?? name);
  }
  await updateBusinessSettings(prisma, ctx.businessId, fields, categories);
  await recordAction(ctx, "settings.updated", "business", ctx.businessId);
}

/** The business's time zone, for showing session times. Any member may know it. */
export async function getTimezone(ctx: TenantContext): Promise<string> {
  return (await findBusinessSettings(prisma, ctx.businessId)).timezone;
}

/** The currency prices are shown in. Any member may know it. */
export async function getCurrency(ctx: TenantContext): Promise<string> {
  return (await findBusinessSettings(prisma, ctx.businessId)).currency;
}
