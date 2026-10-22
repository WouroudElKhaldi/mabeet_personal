import { countNights, type DateRange, toIsoDate } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as analytics from "@/server/repositories/analytics-repository";
import { sumPlanRevenue } from "@/server/repositories/money-repository";
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

export type { Channel } from "@/server/repositories/analytics-repository";
