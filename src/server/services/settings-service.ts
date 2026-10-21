import type { z } from "zod";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { findBusinessSettings, updateBusinessSettings } from "@/server/repositories/business-repository";
import type { settingsInput } from "@/server/validation/schemas";
import { recordAction } from "./audit";

export function getSettings(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  return findBusinessSettings(prisma, ctx.businessId);
}

export async function updateSettings(ctx: TenantContext, input: z.infer<typeof settingsInput>) {
  requirePermission(ctx, "settings.manage");
  const { categories, ...fields } = input;
  await updateBusinessSettings(prisma, ctx.businessId, fields, categories);
  await recordAction(ctx, "settings.updated", "business", ctx.businessId);
}
