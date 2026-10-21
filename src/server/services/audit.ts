import type { TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/repositories/activity-repository";

/** Records what a team member did, for the business activity feed. */
export function recordAction(ctx: TenantContext, action: string, entity: string, entityId: string) {
  return logActivity(prisma, { userId: ctx.userId, businessId: ctx.businessId, action, entity, entityId });
}
