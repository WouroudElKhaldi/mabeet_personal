import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell, type ShellLink } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { formatMoney } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { getPlacesOverview } from "@/server/services/analytics-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overviewAll");
  return { title: t("title"), robots: { index: false } };
}

/** "All my places": every business this person works in, side by side. One place goes straight to it. */
export default async function DashboardIndex() {
  const user = await requirePageUser();
  const places = await getPlacesOverview(user.id);
  if (places.length === 0) redirect("/host");
  if (places.length === 1) redirect(`/dashboard/${places[0]!.id}`);

  const [t, tShell, locale] = await Promise.all([
    getTranslations("overviewAll"),
    getTranslations("shell"),
    getLocale(),
  ]);
  const first = places[0]!;
  const totals = places.reduce(
    (sum, place) => ({
      waiting: sum.waiting + (place.stats?.waiting ?? 0),
      arriving: sum.arriving + (place.stats?.arrivingToday ?? 0),
      leaving: sum.leaving + (place.stats?.leavingToday ?? 0),
      inHouse: sum.inHouse + (place.stats?.inHouse ?? 0),
    }),
    { waiting: 0, arriving: 0, leaving: 0, inHouse: 0 },
  );
  const userLinks: ShellLink[] = [
    { href: `/dashboard/${first.id}/profile`, label: tShell("profile"), icon: "user" },
    ...(user.platformRole === "SUPER_ADMIN"
      ? [{ href: "/admin", label: tShell("admin"), icon: "shield" } satisfies ShellLink]
      : []),
  ];

  return (
    <AppShell
      area={tShell("hostArea")}
      sidebarTop={null}
      groups={[
        {
          label: t("overview"),
          items: [{ href: "/dashboard", label: t("title"), icon: "dashboard", exact: true }],
        },
        {
          label: t("yourPlaces"),
          items: places.map((place) => ({
            href: `/dashboard/${place.id}`,
            label: place.name,
            icon: "building",
          })),
        },
      ]}
      tabs={["/dashboard"]}
      user={{ id: user.id, name: user.name, email: user.email }}
      userLinks={userLinks}
      notificationsHref={`/dashboard/${first.id}/notifications`}
      notificationsFeed={`/api/workspaces/${first.id}/notifications`}
      unread={0}
      profileHref={`/dashboard/${first.id}/profile`}
    >
      <PageHeader
        title={t("title")}
        intro={t("intro", { count: places.length })}
        actions={
          <Link
            href="/host"
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"
          >
            <Plus className="size-4" aria-hidden />
            {t("addPlace")}
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["waiting", totals.waiting],
            ["arriving", totals.arriving],
            ["leaving", totals.leaving],
            ["inHouse", totals.inHouse],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="relative overflow-hidden rounded-xl bg-surface p-5 ring-1 ring-line">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-accent to-glow" aria-hidden />
            <p className="text-sm font-semibold text-muted">{t(`totals.${key}`)}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {places.map((place) => (
          <li key={place.id}>
            <Link
              href={`/dashboard/${place.id}`}
              className="group block h-full rounded-xl bg-surface p-5 ring-1 ring-line transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{place.name}</p>
                  <p className="text-sm text-muted">{place.role}</p>
                </div>
                <ArrowRight
                  className="size-5 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                  aria-hidden
                />
              </div>
              {place.stats ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {(
                    [
                      ["waiting", place.stats.waiting],
                      ["arriving", place.stats.arrivingToday],
                      ["leaving", place.stats.leavingToday],
                      ["inHouse", place.stats.inHouse],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-muted">{t(`totals.${key}`)}</dt>
                      <dd
                        className={
                          key === "waiting" && value > 0 ? "font-semibold text-warning" : "font-semibold"
                        }
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs text-muted">{t("month")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatMoney(place.stats.monthRevenueCents, place.currency, locale)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted">{t("noAccess")}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
