import type { AnalyticsScope } from "@/config/enums";
import { countNights, type DateRange, toIsoDate, todayUtc } from "@/lib/dates";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as analytics from "@/server/repositories/analytics-repository";
import { findBusinessSettings } from "@/server/repositories/business-repository";
import { sumPlanRevenue } from "@/server/repositories/money-repository";
import { listWorkspaces, resolveContext } from "./team-service";

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

/** Adds up values that share a key (a currency, a month, a channel, a status). */
function sumBy(rows: Array<{ key: string; value: number }>): Map<string, number> {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.key, (sums.get(row.key) ?? 0) + row.value);
  return sums;
}

const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

const byKey = ([a]: [string, number], [b]: [string, number]) => a.localeCompare(b);

function combine(places: PlaceAnalytics[]) {
  const reports = places.map((place) => place.report);
  const nightsSold = total(reports.map((report) => report.nightsSold));
  const nightsAvailable = total(reports.map((report) => report.nightsAvailable));
  const ratingCount = total(reports.map((report) => report.rating.count));
  const ratingSum = total(reports.map((report) => report.rating.average * report.rating.count));
  const responseTimes = reports
    .map((report) => report.medianResponseMinutes)
    .filter((minutes): minutes is number => minutes !== null);
  // Monthly revenue is charted in one currency: the first place's. Other currencies stay in the per-place rows.
  const revenueCurrency = reports[0]?.currency ?? "USD";
  const revenueByMonth = sumBy(
    places
      .filter((place) => place.report.currency === revenueCurrency)
      .flatMap((place) => place.revenueByMonth.map((row) => ({ key: row.month, value: row.cents }))),
  );
  const nightsByMonth = sumBy(
    reports.flatMap((report) => report.monthly.map((row) => ({ key: row.month, value: row.nights }))),
  );
  const channels = sumBy(
    reports.flatMap((report) => report.channels.map((row) => ({ key: row.channel, value: row.nights }))),
  );
  return {
    nightsSold,
    nightsAvailable,
    occupancyRate: nightsAvailable === 0 ? 0 : nightsSold / nightsAvailable,
    revenue: Object.fromEntries(
      sumBy(reports.map((report) => ({ key: report.currency, value: report.directRevenueCents }))),
    ),
    commissionSaved: Object.fromEntries(
      sumBy(reports.map((report) => ({ key: report.currency, value: report.commissionSavedCents }))),
    ),
    requests: Object.fromEntries(
      sumBy(
        reports.flatMap((report) =>
          Object.entries(report.requests).map(([status, count]) => ({ key: status, value: count })),
        ),
      ),
    ),
    rating: { average: ratingCount === 0 ? 0 : ratingSum / ratingCount, count: ratingCount },
    medianResponseMinutes:
      responseTimes.length === 0 ? null : Math.round(total(responseTimes) / responseTimes.length),
    nightsByMonth: [...nightsByMonth].sort(byKey).map(([month, nights]) => ({ month, nights })),
    channels: [...channels]
      .map(([channel, nights]) => ({ channel, nights }))
      .sort((a, b) => b.nights - a.nights),
    revenueCurrency,
    revenueByMonth: [...revenueByMonth].sort(byKey).map(([month, cents]) => ({ month, cents })),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export type { Channel } from "@/server/repositories/analytics-repository";
