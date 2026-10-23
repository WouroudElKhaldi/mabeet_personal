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
    contactBy: input.contactBy,
  });
  await recordAction(ctx, "host_profile.saved", "user", ctx.userId);
  return profile;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface HostSection {
  /** The host's own name when they show their profile, otherwise the place's name. */
  name: string;
  personal: boolean;
  bio: string | null;
  languages: string[];
  yearsHosting: number;
  responseRate: number | null;
  medianResponseMinutes: number | null;
  /** The number to open in WhatsApp, or null when the host has none or chose the Contact host page only. */
  whatsapp: string | null;
  /** Guests can write to the host from the Contact host page, which emails them. */
  acceptsMessages: boolean;
}

/**
 * "Meet your host": the host's own details when they chose to show them, and for every place the facts guests
 * use to trust a host: years hosting, response rate and time. Reviews and rating come from the place.
 */
export async function getHostSection(
  place: { id: string; name: string; whatsapp: string | null },
  now = new Date(),
): Promise<HostSection> {
  const [owner, stats] = await Promise.all([
    hosts.findPlaceOwner(prisma, place.id),
    hosts.responseStats(prisma, place.id, new Date(now.getTime() - YEAR_MS)),
  ]);
  const profile = owner?.hostProfile?.showOnListings ? owner.hostProfile : null;
  // The contact choice applies whether or not the profile itself is shown.
  const contactBy = owner?.hostProfile?.contactBy ?? "BOTH";
  const since = profile?.hostingSince
    ? new Date(Date.UTC(profile.hostingSince, 0, 1))
    : (owner?.createdAt ?? now);
  return {
    name: profile ? (profile.displayName ?? owner?.name ?? place.name) : place.name,
    personal: profile !== null,
    bio: profile?.bio ?? null,
    languages: profile?.languages ?? [],
    yearsHosting: Math.max(0, Math.floor((now.getTime() - since.getTime()) / YEAR_MS)),
    responseRate: stats.total > 0 ? stats.answered / stats.total : null,
    medianResponseMinutes: stats.minutes,
    whatsapp: contactBy === "MESSAGE" ? null : (profile?.whatsapp ?? place.whatsapp),
    acceptsMessages: contactBy !== "WHATSAPP",
  };
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
