import { clsx } from "clsx";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ChannelsChart,
  NightsChart,
  RequestsChart,
  RevenueChart,
} from "@/components/dashboard/analytics-charts";
import { ReportGenerator } from "@/components/dashboard/report-generator";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ANALYTICS_SCOPES } from "@/config/enums";
import { addDays, toIsoDate, todayUtc } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { getAnalytics } from "@/server/services/analytics-service";
import { analyticsQuery } from "@/server/validation/schemas";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string>>;
};

const PRESETS = [30, 90, 365] as const;

/** Analytics straight from the database for a chosen period, for this place or all the person's places. */
export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["analytics.read"]);
  const today = todayUtc();
  const defaults = { from: toIsoDate(addDays(today, -90)), to: toIsoDate(addDays(today, 1)), scope: "place" };
  const parsed = analyticsQuery.safeParse({ ...defaults, ...(await searchParams) });
  const query = parsed.success ? parsed.data : analyticsQuery.parse(defaults);
  const range = { checkIn: new Date(`${query.from}T00:00:00Z`), checkOut: new Date(`${query.to}T00:00:00Z`) };
  const [t, tChannel, tStatus, locale, data] = await Promise.all([
    getTranslations("analytics"),
    getTranslations("dashboard.overview.channel"),
    getTranslations("dashboard.bookings.status"),
    getLocale(),
    getAnalytics(ctx, query.scope, range),
  ]);
  const totals = data.totals;
  const month = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const labels = {
    month: (iso: string) => month.format(new Date(`${iso}-01T00:00:00Z`)),
    money: (cents: number) => formatMoney(cents, totals.revenueCurrency, locale),
    nights: (count: number) => t("nights", { count }),
    channel: (key: string) => tChannel(key as "DIRECT"),
    status: (key: string) => tStatus(key as "HELD"),
  };
  const href = (changes: Record<string, string>) =>
    `?${new URLSearchParams({ from: query.from, to: query.to, scope: query.scope, ...changes })}`;
  const requests = Object.values(totals.requests).reduce((sum, count) => sum + count, 0);
  const moneyList = (byCurrency: Record<string, number>) =>
    Object.entries(byCurrency)
      .map(([currency, cents]) => formatMoney(cents, currency, locale))
      .join(" · ") || formatMoney(0, totals.revenueCurrency, locale);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />

      {/* Filters: a plain form, so every view has its own link. */}
      <form className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((days) => {
            const from = toIsoDate(addDays(today, -days));
            return (
              <Link
                key={days}
                href={href({ from, to: toIsoDate(addDays(today, 1)) })}
                className={clsx(
                  "h-9 rounded-full px-3.5 text-sm leading-9 font-semibold ring-1",
                  query.from === from ? "bg-ink text-paper ring-ink" : "ring-line hover:bg-surface-2",
                )}
              >
                {t(`presets.${days}`)}
              </Link>
            );
          })}
        </div>
        <label className="grid gap-1 text-xs font-semibold">
          {t("from")}
          <input type="date" name="from" defaultValue={query.from} className={clsx(inputClass, "h-9")} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("to")}
          <input type="date" name="to" defaultValue={query.to} className={clsx(inputClass, "h-9")} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("scope")}
          <select name="scope" defaultValue={query.scope} className={clsx(inputClass, "h-9")}>
            {ANALYTICS_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(`scopes.${scope}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("occupancy")}
          value={totals.occupancyRate}
          kind="percent"
          note={t("nightsOf", { sold: totals.nightsSold, available: totals.nightsAvailable })}
        />
        <div className="grid gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("revenue")}</p>
          <p className="text-2xl font-semibold tabular-nums">{moneyList(totals.revenue)}</p>
        </div>
        <div className="grid gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("saved")}</p>
          <p className="text-2xl font-semibold tabular-nums">{moneyList(totals.commissionSaved)}</p>
        </div>
        <StatTile
          label={t("rating")}
          value={totals.rating.count}
          kind="count"
          note={
            totals.rating.count > 0
              ? t("ratingNote", { average: totals.rating.average.toFixed(2) })
              : t("noReviews")
          }
        />
        <StatTile label={t("requests")} value={requests} kind="count" />
        <StatTile label={t("nightsSold")} value={totals.nightsSold} kind="count" />
        <div className="grid gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("response")}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {totals.medianResponseMinutes === null
              ? "—"
              : t("minutes", { count: totals.medianResponseMinutes })}
          </p>
        </div>
        <StatTile label={t("places")} value={data.places.length} kind="count" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title={t("nightsByMonth")}>
          {totals.nightsByMonth.length > 0 ? (
            <NightsChart rows={totals.nightsByMonth} labels={labels} />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel
          title={t("revenueByMonth")}
          intro={
            Object.keys(totals.revenue).length > 1
              ? t("currencyNote", { currency: totals.revenueCurrency })
              : undefined
          }
        >
          {totals.revenueByMonth.length > 0 ? (
            <RevenueChart rows={totals.revenueByMonth} labels={labels} />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel title={t("channels")}>
          {totals.channels.length > 0 ? (
            <ChannelsChart rows={totals.channels} labels={labels} />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel title={t("requestsByStatus")}>
          {requests > 0 ? (
            <RequestsChart counts={totals.requests} labels={labels} />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
      </div>

      {data.places.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{t("byPlace")}</h2>
          <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-start">{t("place")}</th>
                  <th className="px-4 py-3 text-end">{t("occupancy")}</th>
                  <th className="px-4 py-3 text-end">{t("nightsSold")}</th>
                  <th className="px-4 py-3 text-end">{t("revenue")}</th>
                  <th className="px-4 py-3 text-end">{t("rating")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.places.map((place) => (
                  <tr key={place.businessId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{place.name}</td>
                    <td className="px-4 py-3 text-end">{Math.round(place.report.occupancyRate * 100)}%</td>
                    <td className="px-4 py-3 text-end">{place.report.nightsSold}</td>
                    <td className="px-4 py-3 text-end">
                      {formatMoney(place.report.directRevenueCents, place.report.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {place.report.rating.count > 0 ? `${place.report.rating.average.toFixed(2)}★` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {can(ctx, "ai.use") && (
        <ReportGenerator businessId={businessId} from={query.from} to={query.to} scope={query.scope} />
      )}
    </>
  );
}
