import type { z } from "zod";
import { prisma } from "@/server/db/client";
import { forbidden, notFound } from "@/server/errors";
import type { TenantContext } from "@/server/auth/tenant-context";
import * as hosts from "@/server/repositories/host-repository";
import type { hostProfileInput } from "@/server/validation/schemas";
import { type PlatformActor, requireSuperAdmin } from "./admin-service";
import { recordAction } from "./audit";

// A host's own profile. It belongs to the person, not to one business: a host with five places keeps one
// profile. It is always kept; guests see it only when the host turns "show on my listings" on.

function requireOwner(ctx: TenantContext): void {
  if (!ctx.isOwner) throw forbidden("Only an owner has a host profile");
}

export async function getMyHostProfile(ctx: TenantContext) {
  requireOwner(ctx);
  return hosts.findHostProfile(prisma, ctx.userId);
}

export async function saveMyHostProfile(ctx: TenantContext, input: z.infer<typeof hostProfileInput>) {
  requireOwner(ctx);
  const profile = await hosts.saveHostProfile(prisma, ctx.userId, {
    displayName: input.displayName ?? null,
    bio: input.bio ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    city: input.city ?? null,
    languages: input.languages,
    hostingSince: input.hostingSince ?? null,
    showOnListings: input.showOnListings,
  });
  await recordAction(ctx, "host_profile.saved", "user", ctx.userId);
  return profile;
}

/** The host card on a place or experience page; null when the host keeps their profile private. */
export function getPublicHost(businessId: string) {
  return hosts.findPublicHost(prisma, businessId);
}

/** Platform admin: every host, each once, with all their businesses. */
export function listHosts(actor: PlatformActor) {
  requireSuperAdmin(actor);
  return hosts.listHosts(prisma);
}

/** Platform admin: one host's full profile (shown or not) and their businesses. */
export async function getHost(actor: PlatformActor, userId: string) {
  requireSuperAdmin(actor);
  const host = await hosts.findHost(prisma, userId);
  if (!host) throw notFound("Host");
  return host;
}
