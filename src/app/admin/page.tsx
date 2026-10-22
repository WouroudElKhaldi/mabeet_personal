import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { formatDate } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { getAiUsage, getPlatformOverview, getSyncHealth } from "@/server/services/admin-service";
import { getPlatformMoney } from "@/server/services/payout-service";

/** The platform at a glance, and what needs the admin's attention today. */
export default async function AdminOverviewPage() {
  const user = await requirePageUser();
  const [t, locale, { totals, businesses }, ai, sync, money] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    getPlatformOverview(user),
    getAiUsage(user),
    getSyncHealth(user),
    getPlatformMoney(user),
  ]);
  const usd = (micro: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
      micro / 1_000_000,
    );
  const earned = money.revenue.thisMonth
    .filter((row) => row.currency === "USD")
    .reduce((sum, row) => sum + (row._sum.amountCents ?? 0), 0);
  const attention = [
    {
      href: "/admin/money",
      label: t("attention.payouts", { count: money.requests.length }),
      urgent: money.requests.length > 0,
    },
    {
      href: "/admin/money",
      label: t("attention.refunds", { count: money.refunds.length }),
      urgent: money.refunds.length > 0,
    },
    {
      href: "/admin/health",
      label: t("attention.feeds", { count: sync.unhealthy.length }),
      urgent: sync.unhealthy.length > 0,
    },
    {
      href: "/admin/health",
      label: t("ai.ofBudget", { spent: usd(ai.costMicroUsd), budget: usd(ai.budgetMicroUsd) }),
      urgent: ai.costMicroUsd >= ai.budgetMicroUsd * 0.8,
    },
  ];

  return (
    <>
      <PageHeader title={t("nav.overview")} intro={t("overviewIntro")} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("businesses")} value={totals.businesses} kind="count" />
        <StatTile label={t("users")} value={totals.users} kind="count" />
        <StatTile
          label={t("bookings30")}
          value={totals.recentBookings}
          kind="count"
          note={t("allTime", { count: totals.bookings })}
        />
        <StatTile label={t("money.earnedMonth")} value={earned} kind="money" currency="USD" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title={t("attention.title")}>
          <ul className="grid gap-2">
            {attention.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm ring-1 ring-line transition-colors hover:bg-surface-2"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={clsx(
                        "size-2.5 shrink-0 rounded-full",
                        item.urgent ? "bg-danger" : "bg-success",
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title={t("newestBusinesses")}
          action={
            <Link href="/admin/businesses" className="text-sm font-semibold text-accent hover:underline">
              {t("seeAll")}
            </Link>
          }
        >
          <ul className="grid gap-1">
            {businesses.slice(0, 6).map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-0"
              >
                <span className="truncate font-semibold">{business.name}</span>
                <span className="shrink-0 text-muted">{formatDate(business.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
