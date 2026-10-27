import { getLocale, getTranslations } from "next-intl/server";
import { BarChart, ShareBar } from "@/components/dashboard/bar-chart";
import { BookingRow } from "@/components/dashboard/booking-row";
import { channelColor } from "@/components/dashboard/channel-colors";
import { SessionBookingRow } from "@/components/dashboard/session-booking-row";
import { StatTile } from "@/components/dashboard/stat-tile";
import { panelClass } from "@/components/ui/field";
import { addDays, todayUtc } from "@/lib/dates";
import { stagger } from "@/lib/motion";
import { can } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";
import { getBusinessReport, getSavings } from "@/server/services/analytics-service";
import { listBookings } from "@/server/services/booking-service";
import { listSessionBookings } from "@/server/services/session-booking-service";
import { getTimezone } from "@/server/services/settings-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function OverviewPage({ params }: PageProps) {
  const ctx = await requirePageTenant((await params).businessId);
  const [t, locale] = await Promise.all([getTranslations("dashboard.overview"), getLocale()]);
  const today = todayUtc();
  const last90 = { checkIn: addDays(today, -90), checkOut: addDays(today, 1) };
  const canRead = can(ctx, "bookings.read");
  const [report, savings, pending, pendingSessions, timezone] = await Promise.all([
    can(ctx, "analytics.read") ? getBusinessReport(ctx, last90) : null,
    can(ctx, "analytics.read") ? getSavings(ctx) : [],
    canRead ? listBookings(ctx, { status: "HELD", take: 20, skip: 0 }) : [],
    canRead ? listSessionBookings(ctx, { status: "HELD", take: 20 }) : [],
    getTimezone(ctx),
  ]);
  const waiting = pending.length + pendingSessions.length;
  const monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });

  return (
    <div className="grid gap-10">
      <header className="rise-in">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      {report && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("kpis")}>
          <div className="rise-in h-full" style={stagger(1)}>
            <StatTile label={t("occupancy")} value={report.occupancyRate} kind="percent" note={t("last90")} />
          </div>
          <div className="rise-in h-full" style={stagger(2)}>
            <StatTile
              label={t("directRevenue")}
              value={report.directRevenueCents}
              kind="money"
              currency={report.currency}
            />
          </div>
          <div className="rise-in h-full" style={stagger(3)}>
            <StatTile
              label={t("commissionSaved")}
              value={report.commissionSavedCents}
              kind="money"
              currency={report.currency}
              note={t("vsPlatforms")}
            />
          </div>
          <div className="rise-in h-full" style={stagger(4)}>
            <StatTile label={t("nightsSold")} value={report.nightsSold} kind="count" />
          </div>
        </section>
      )}

      {savings.map((row) => (
        <section key={row.currency} className={panelClass}>
          <h2 className="text-2xl font-semibold">{t("savings.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("savings.intro")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={t("savings.revenue")}
              value={row.directRevenueCents}
              kind="money"
              currency={row.currency}
            />
            <StatTile
              label={t("savings.saved")}
              value={row.commissionSavedCents}
              kind="money"
              currency={row.currency}
              note={t("vsPlatforms")}
            />
            <StatTile label={t("savings.fees")} value={row.planFeesUsdCents} kind="money" currency="USD" />
            {row.currency === "USD" && (
              <StatTile
                label={t("savings.kept")}
                value={row.commissionSavedCents - row.planFeesUsdCents}
                kind="money"
                currency="USD"
                note={t("savings.keptNote")}
              />
            )}
          </div>
        </section>
      ))}

      {can(ctx, "bookings.read") && (
        <section>
          <h2 className="text-2xl font-semibold">{t("requests", { count: waiting })}</h2>
          {waiting === 0 ? (
            <p className="mt-4 rounded-lg bg-surface p-6 text-muted ring-1 ring-line">{t("noRequests")}</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {pending.map((booking) => (
                <BookingRow key={booking.id} ctx={ctx} booking={booking} />
              ))}
              {pendingSessions.map((booking) => (
                <SessionBookingRow key={booking.id} ctx={ctx} booking={booking} timezone={timezone} />
              ))}
            </ul>
          )}
        </section>
      )}

      {report && (
        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-xl font-semibold">{t("nightsByMonth")}</h2>
            <div className="mt-6">
              {report.monthly.length === 0 ? (
                <p className="text-sm text-muted">{t("noNightsYet")}</p>
              ) : (
                <BarChart
                  bars={report.monthly.map((month) => {
                    const label = monthName.format(new Date(`${month.month}-01T00:00:00Z`));
                    return {
                      label,
                      value: month.nights,
                      title: t("nightsTitle", { month: label, count: month.nights }),
                    };
                  })}
                />
              )}
            </div>
          </div>
          <div className="rounded-lg bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-xl font-semibold">{t("channels")}</h2>
            <p className="mt-1 text-sm text-muted">{t("channelsHint")}</p>
            <div className="mt-6">
              {report.channels.length === 0 ? (
                <p className="text-sm text-muted">{t("noNightsYet")}</p>
              ) : (
                <ShareBar
                  shares={report.channels.map((channel) => ({
                    label: t(`channel.${channel.channel}`),
                    value: channel.nights,
                    className: channelColor(channel.channel),
                  }))}
                />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
