import type { z } from "zod";
import { slugify } from "@/lib/slug";
import { secureToken } from "@/lib/tokens";
import { zonedInstant } from "@/lib/zoned-time";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import { findBusinessSettings } from "@/server/repositories/business-repository";
import { listCategories } from "@/server/repositories/directory-repository";
import * as offerings from "@/server/repositories/offering-repository";
import type { offeringInput, offeringUpdate, sessionsInput } from "@/server/validation/schemas";
import { recordAction } from "./audit";
import { assertPlanAllowsAnother } from "./billing-service";

type OfferingInput = z.infer<typeof offeringInput>;

export function listOfferings(ctx: TenantContext) {
  requirePermission(ctx, "offerings.manage");
  return offerings.listOfferings(prisma, ctx.businessId);
}

/** A category must exist and belong to the same type (an experience cannot be filed under "Transfers"). */
async function assertCategoryFits(kind: OfferingInput["kind"], categorySlug: string | null | undefined) {
  if (!categorySlug) return;
  const category = (await listCategories(prisma)).find((candidate) => candidate.slug === categorySlug);
  if (!category || category.kind !== kind) throw invalid("Pick a category of the same type");
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "experience";
  if (!(await offerings.slugTaken(prisma, base))) return base;
  return `${base}-${secureToken(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
}

export async function createOffering(ctx: TenantContext, input: OfferingInput) {
  requirePermission(ctx, "offerings.manage");
  await assertPlanAllowsAnother(ctx.businessId, "offerings");
  await assertCategoryFits(input.kind, input.categorySlug);
  const offering = await offerings.createOffering(prisma, {
    ...input,
    businessId: ctx.businessId,
    slug: await uniqueSlug(input.title),
  });
  await recordAction(ctx, "offering.created", "offering", offering.id);
  return offering;
}

export async function updateOffering(
  ctx: TenantContext,
  offeringId: string,
  input: z.infer<typeof offeringUpdate>,
) {
  requirePermission(ctx, "offerings.manage");
  const current = await offerings.findOffering(prisma, ctx.businessId, offeringId);
  if (!current) throw notFound("Experience");
  if (input.categorySlug !== undefined || input.kind) {
    await assertCategoryFits(
      input.kind ?? (current.kind as OfferingInput["kind"]),
      input.categorySlug ?? current.categorySlug,
    );
  }
  await offerings.updateOffering(prisma, ctx.businessId, offeringId, input);
  await recordAction(ctx, "offering.updated", "offering", offeringId);
}

/** Schedules one session per date at the same local time, in the business's time zone. Only future times. */
export async function addSessions(
  ctx: TenantContext,
  offeringId: string,
  input: z.infer<typeof sessionsInput>,
  now = new Date(),
) {
  requirePermission(ctx, "offerings.manage");
  const offering = await offerings.findOffering(prisma, ctx.businessId, offeringId);
  if (!offering) throw notFound("Experience");
  const { timezone } = await findBusinessSettings(prisma, ctx.businessId);
  const sessions = [...new Set(input.dates)].map((date) => {
    const startsAt = zonedInstant(date, input.time, timezone);
    return {
      businessId: ctx.businessId,
      offeringId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + offering.durationMinutes * 60_000),
      capacity: input.capacity,
    };
  });
  if (sessions.some((session) => session.startsAt <= now)) throw invalid("Sessions must start in the future");
  const { count } = await offerings.createSessions(prisma, sessions);
  await recordAction(ctx, "session.added", "offering", offeringId);
  return { added: count };
}

/** A session with guests on it cannot vanish under them: decline or cancel their bookings first. */
export async function cancelSession(ctx: TenantContext, sessionId: string) {
  requirePermission(ctx, "offerings.manage");
  if ((await offerings.countActiveSessionBookings(prisma, sessionId)) > 0) {
    throw conflict("Guests are booked on this session. Cancel their bookings first.");
  }
  if (!(await offerings.deactivateSession(prisma, ctx.businessId, sessionId))) throw notFound("Session");
  await recordAction(ctx, "session.cancelled", "session", sessionId);
}

/** Upcoming sessions with seats taken, for the schedule. Staff who can read bookings may see it. */
export function getSchedule(ctx: TenantContext, from: Date, to: Date) {
  if (!can(ctx, "offerings.manage") && !can(ctx, "bookings.read")) throw forbidden();
  return offerings.listBusinessSessions(prisma, ctx.businessId, from, to);
}
