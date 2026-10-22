import { clsx } from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BusinessStatusToggle } from "@/components/dashboard/business-status-toggle";
import { CategoryManager } from "@/components/dashboard/category-manager";
import { SitePalettePicker } from "@/components/dashboard/site-palette-picker";
import { Wordmark } from "@/components/site/wordmark";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { formatDate } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import {
  getAiUsage,
  getPlatformOverview,
  getSyncHealth,
  listCategoriesForAdmin,
} from "@/server/services/admin-service";
import { getSitePalette } from "@/server/services/site-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminPage() {
  const user = await requirePageUser("/admin");
  if (user.platformRole !== "SUPER_ADMIN") notFound();
  const [t, locale, { totals, businesses, users }, palette, categories, ai, sync] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    getPlatformOverview(user),
    getSitePalette(),
    listCategoriesForAdmin(user),
    getAiUsage(user),
    getSyncHealth(user),
  ]);
  const usd = (micro: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
      micro / 1_000_000,
    );
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between">
        <Wordmark />
        <AppearanceMenu />
      </header>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <h1 className="rise-in text-4xl font-semibold">{t("title")}</h1>
        <Link href="/admin/money" className="font-semibold underline underline-offset-4">
          {t("money.link")}
        </Link>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("businesses")} value={totals.businesses} kind="count" />
        <StatTile label={t("users")} value={totals.users} kind="count" />
        <StatTile
          label={t("bookings30")}
          value={totals.recentBookings}
          kind="count"
          note={t("allTime", { count: totals.bookings })}
        />
        {(totals.recentConfirmed.length > 0 ? totals.recentConfirmed : [{ currency: "USD", cents: 0 }]).map(
          ({ currency, cents }) => (
            <StatTile
              key={currency}
              label={t("confirmed30")}
              value={cents}
              kind="money"
              currency={currency}
            />
          ),
        )}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">{t("ai.title")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            {t("ai.ofBudget", { spent: usd(ai.costMicroUsd), budget: usd(ai.budgetMicroUsd) })}
          </p>
          <div
            className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2"
            role="meter"
            aria-label={t("ai.title")}
            aria-valuemin={0}
            aria-valuemax={ai.budgetMicroUsd}
            aria-valuenow={ai.costMicroUsd}
          >
            <div
              className={clsx(
                "h-full rounded-full",
                ai.costMicroUsd >= ai.budgetMicroUsd * 0.8 ? "bg-danger" : "bg-accent",
              )}
              style={{ width: `${Math.min(100, (ai.costMicroUsd / ai.budgetMicroUsd) * 100)}%` }}
            />
          </div>
          {ai.surfaces.length === 0 ? (
            <p className="text-sm text-faint">{t("ai.none")}</p>
          ) : (
            <ul className="grid gap-2">
              {ai.surfaces.map((row) => (
                <li
                  key={row.surface}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface p-4 text-sm ring-1 ring-line"
                >
                  <span className="font-semibold">
                    {t(`ai.surfaces.${row.surface === "team" ? "team" : "concierge"}`)}
                  </span>
                  <span className="text-muted tabular-nums">
                    {t("ai.row", { answers: row.answers, tokens: row.tokens })} · {usd(row.costMicroUsd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{t("sync.title")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            {t("sync.summary", { total: sync.total, problems: sync.unhealthy.length })}
          </p>
          {sync.unhealthy.length === 0 ? (
            <p className="text-sm text-faint">{t("sync.allGood")}</p>
          ) : (
            <ul className="grid gap-2">
              {sync.unhealthy.map((feed) => (
                <li key={feed.id} className="rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
                  <p className="font-semibold">
                    {feed.business.name} · {feed.room.name}{" "}
                    <span className="font-normal text-muted">({feed.source})</span>
                  </p>
                  <p className="mt-1 text-muted">
                    {feed.lastSyncedAt
                      ? t("sync.lastSynced", { when: when.format(feed.lastSyncedAt) })
                      : t("sync.never")}
                  </p>
                  {feed.lastError && <p className="mt-1 text-danger">{feed.lastError}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("theme.title")}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{t("theme.hint")}</p>
        <SitePalettePicker current={palette} />
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("categories.title")}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{t("categories.hint")}</p>
        <CategoryManager
          categories={categories.map(({ _count, ...category }) => ({
            ...category,
            uses: _count.businesses + _count.offerings,
          }))}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("businesses")}</h2>
        <div className="mt-4 overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-start text-xs tracking-wide text-muted uppercase">
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-start">{t("name")}</th>
                <th className="px-4 py-3 text-start">{t("area")}</th>
                <th className="px-4 py-3 text-end">{t("rooms")}</th>
                <th className="px-4 py-3 text-end">{t("bookings")}</th>
                <th className="px-4 py-3 text-end">{t("team")}</th>
                <th className="px-4 py-3 text-start">{t("since")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr
                  key={business.id}
                  className={clsx(
                    "border-b border-line last:border-0",
                    business.status === "SUSPENDED" && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/p/${business.slug}`} className="hover:underline">
                      {business.name}
                    </Link>
                    {business.listedPublicly && (
                      <span className="ms-2 text-xs text-accent">{t("listed")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{business.area}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{business._count.rooms}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{business._count.bookings}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{business._count.memberships}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(business.createdAt, locale)}</td>
                  <td className="px-4 py-3 text-end">
                    <BusinessStatusToggle
                      businessId={business.id}
                      businessName={business.name}
                      suspended={business.status === "SUSPENDED"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("recentUsers")}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {users.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="truncate text-sm text-muted">{member.email}</p>
              </div>
              <p className="text-end text-xs text-muted">
                {t("userCounts", { places: member._count.memberships, trips: member._count.bookings })}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
