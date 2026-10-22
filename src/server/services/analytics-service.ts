import { countNights, type DateRange, toIsoDate, todayUtc } from "@/lib/dates";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as analytics from "@/server/repositories/analytics-repository";
import { sumPlanRevenue } from "@/server/repositories/money-repository";
import { listWorkspaces, resolveContext } from "./team-service";
import { findBusinessSettings } from "@/server/repositories/business-repository";

// One reporting layer for the dashboard, the owner AI and the MCP tools, so their numbers always match.

export interface BusinessReport {
  range: { from: string; to: string };
  currency: string;
  occupancyRate: number;
  nightsSold: number;
  nightsAvailable: number;
  directRevenueCents: number;
  averageDailyRateCents: number | null;
  commissionSavedCents: number;
  channels: analytics.ChannelNights[];
  monthly: analytics.MonthlyNights[];
  requests: Record<string, number>;
  medianResponseMinutes: number | null;
  rating: { average: number; count: number };
}

export async function getBusinessReport(ctx: TenantContext, range: DateRange): Promise<BusinessReport> {
  requirePermission(ctx, "analytics.read");
  const { businessId } = ctx;
  const [business, channels, monthly, revenue, rooms, requests, response, rating] = await Promise.all([
    findBusinessSettings(prisma, businessId),
    analytics.soldNightsByChannel(prisma, businessId, range),
    analytics.soldNightsByMonth(prisma, businessId, range),
    analytics.directRevenueCents(prisma, businessId, range),
    analytics.countActiveRooms(prisma, businessId),
    analytics.bookingRequestsByStatus(prisma, businessId, range),
    analytics.medianResponseMinutes(prisma, businessId, range),
    analytics.ratingSummary(prisma, businessId),
  ]);

  const nightsSold = channels.reduce((sum, channel) => sum + channel.nights, 0);
  const nightsAvailable = rooms * countNights(range);
  const directNights = channels.find((channel) => channel.channel === "DIRECT")?.nights ?? 0;

  return {
    range: { from: toIsoDate(range.checkIn), to: toIsoDate(range.checkOut) },
    currency: business.currency,
    occupancyRate: nightsAvailable === 0 ? 0 : nightsSold / nightsAvailable,
    nightsSold,
    nightsAvailable,
    directRevenueCents: revenue,
    averageDailyRateCents: directNights === 0 ? null : Math.round(revenue / directNights),
    commissionSavedCents: Math.round((revenue * business.commissionRateBps) / 10_000),
    channels,
    monthly,
    requests: Object.fromEntries(requests.map((row) => [row.status, row._count._all])),
    medianResponseMinutes: response,
    rating: { average: rating._avg.rating ?? 0, count: rating._count._all },
  };
}

export interface Savings {
  currency: string;
  /** Every confirmed direct booking since the business joined. */
  directRevenueCents: number;
  /** What Airbnb or Booking.com would have taken from it, at the business's own rate. */
  commissionSavedCents: number;
  /** What the business paid Mabeet for plans, in US dollars. */
  planFeesUsdCents: number;
}

/** All-time: what booking direct through Mabeet saved this business, against what it paid Mabeet. */
export async function getSavings(ctx: TenantContext): Promise<Savings[]> {
  requirePermission(ctx, "analytics.read");
  const [business, revenue, fees] = await Promise.all([
    findBusinessSettings(prisma, ctx.businessId),
    analytics.lifetimeDirectRevenue(prisma, ctx.businessId),
    sumPlanRevenue(prisma, { businessId: ctx.businessId }),
  ]);
  const planFeesUsdCents = fees
    .filter((row) => row.currency === "USD")
    .reduce((sum, row) => sum + (row._sum.amountCents ?? 0), 0);
  const rows = revenue.length > 0 ? revenue : [{ currency: business.currency, cents: 0 }];
  return rows.map((row) => ({
    currency: row.currency,
    directRevenueCents: row.cents,
    commissionSavedCents: Math.round((row.cents * business.commissionRateBps) / 10_000),
    planFeesUsdCents,
  }));
}

/**
 * An owner's places side by side: today's arrivals and departures, who's in, requests waiting and this month's
 * direct revenue. Only for places where the person may read bookings; the rest are listed without numbers.
 */
export async function getPlacesOverview(userId: string, today = todayUtc()) {
  const memberships = await listWorkspaces(userId);
  const contexts = await Promise.all(
    memberships.map((membership) => resolveContext(userId, membership.businessId)),
  );
  const readable = contexts.filter((ctx): ctx is TenantContext => ctx !== null && can(ctx, "bookings.read"));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const [snapshots, currencies] = await Promise.all([
    readable.length > 0
      ? analytics.placeSnapshots(
          prisma,
          readable.map((ctx) => ctx.businessId),
          today,
          monthStart,
          nextMonth,
        )
      : Promise.resolve([]),
    Promise.all(readable.map((ctx) => findBusinessSettings(prisma, ctx.businessId))),
  ]);
  const byId = new Map(snapshots.map((row) => [row.businessId, row]));
  const currencyOf = new Map(
    readable.map((ctx, index) => [ctx.businessId, currencies[index]?.currency ?? "USD"]),
  );
  return memberships.map((membership) => ({
    id: membership.businessId,
    name: membership.business.name,
    slug: membership.business.slug,
    role: membership.role.name,
    currency: currencyOf.get(membership.businessId) ?? "USD",
    stats: currencyOf.has(membership.businessId)
      ? (byId.get(membership.businessId) ?? {
          waiting: 0,
          arrivingToday: 0,
          leavingToday: 0,
          inHouse: 0,
          monthRevenueCents: 0,
        })
      : null,
  }));
}

export type { Channel } from "@/server/repositories/analytics-repository";
