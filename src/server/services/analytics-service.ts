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

export type AnalyticsScope = "place" | "all";

export interface PlaceAnalytics {
  businessId: string;
  name: string;
  report: BusinessReport;
  revenueByMonth: analytics.MonthlyRevenue[];
}

/**
 * Analytics for one place, or for every place where this person may read analytics, over a period. Every number
 * comes from the database; totals add places up (revenue per currency, so mixed currencies never get summed).
 */
export async function getAnalytics(ctx: TenantContext, scope: AnalyticsScope, range: DateRange) {
  requirePermission(ctx, "analytics.read");
  const contexts =
    scope === "place" || ctx.platformAdmin
      ? [ctx]
      : (
          await Promise.all(
            (await listWorkspaces(ctx.userId)).map((membership) =>
              resolveContext(ctx.userId, membership.businessId),
            ),
          )
        ).filter((member): member is TenantContext => member !== null && can(member, "analytics.read"));
  const places: PlaceAnalytics[] = await Promise.all(
    contexts.map(async (member) => {
      const [report, monthly, settings] = await Promise.all([
        getBusinessReport(member, range),
        analytics.revenueByMonth(prisma, member.businessId, range),
        findBusinessSettings(prisma, member.businessId),
      ]);
      return { businessId: member.businessId, name: settings.name, report, revenueByMonth: monthly };
    }),
  );
  return {
    range: { from: toIsoDate(range.checkIn), to: toIsoDate(range.checkOut) },
    places,
    totals: combine(places),
  };
}

function combine(places: PlaceAnalytics[]) {
  /** Adds up values that share a key (a month, a channel). */
  const sumBy = (rows: Array<{ key: string; value: number }>) => {
    const sums = new Map<string, number>();
    for (const row of rows) sums.set(row.key, (sums.get(row.key) ?? 0) + row.value);
    return sums;
  };
  const nightsSold = places.reduce((sum, place) => sum + place.report.nightsSold, 0);
  const nightsAvailable = places.reduce((sum, place) => sum + place.report.nightsAvailable, 0);
  const revenue = new Map<string, number>();
  const saved = new Map<string, number>();
  for (const place of places) {
    revenue.set(
      place.report.currency,
      (revenue.get(place.report.currency) ?? 0) + place.report.directRevenueCents,
    );
    saved.set(
      place.report.currency,
      (saved.get(place.report.currency) ?? 0) + place.report.commissionSavedCents,
    );
  }
  const requests = new Map<string, number>();
  for (const place of places) {
    for (const [status, count] of Object.entries(place.report.requests)) {
      requests.set(status, (requests.get(status) ?? 0) + count);
    }
  }
  const ratingCount = places.reduce((sum, place) => sum + place.report.rating.count, 0);
  const ratingSum = places.reduce(
    (sum, place) => sum + place.report.rating.average * place.report.rating.count,
    0,
  );
  const responses = places
    .map((place) => place.report.medianResponseMinutes)
    .filter((value): value is number => value !== null);
  const nightsByMonth = sumBy(
    places.flatMap((place) => place.report.monthly.map((row) => ({ key: row.month, value: row.nights }))),
  );
  const channels = sumBy(
    places.flatMap((place) => place.report.channels.map((row) => ({ key: row.channel, value: row.nights }))),
  );
  const revenueByMonth = new Map<string, number>();
  const currency = places[0]?.report.currency ?? "USD";
  for (const place of places.filter((candidate) => candidate.report.currency === currency)) {
    for (const row of place.revenueByMonth)
      revenueByMonth.set(row.month, (revenueByMonth.get(row.month) ?? 0) + row.cents);
  }
  return {
    nightsSold,
    nightsAvailable,
    occupancyRate: nightsAvailable === 0 ? 0 : nightsSold / nightsAvailable,
    revenue: Object.fromEntries(revenue),
    commissionSaved: Object.fromEntries(saved),
    requests: Object.fromEntries(requests),
    rating: { average: ratingCount === 0 ? 0 : ratingSum / ratingCount, count: ratingCount },
    medianResponseMinutes:
      responses.length === 0 ? null : Math.round(responses.reduce((a, b) => a + b, 0) / responses.length),
    nightsByMonth: [...nightsByMonth]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, nights]) => ({ month, nights })),
    channels: [...channels]
      .map(([channel, nights]) => ({ channel, nights }))
      .sort((a, b) => b.nights - a.nights),
    revenueCurrency: currency,
    revenueByMonth: [...revenueByMonth]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cents]) => ({ month, cents })),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export type { Channel } from "@/server/repositories/analytics-repository";
