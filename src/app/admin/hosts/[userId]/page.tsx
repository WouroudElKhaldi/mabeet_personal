import { clsx } from "clsx";
import { ExternalLink, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BusinessStatusToggle } from "@/components/dashboard/business-status-toggle";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { formatDate } from "@/lib/format";
import { findPageOr404 } from "@/server/http/page";
import { requirePageUser } from "@/server/http/session";
import { getHost } from "@/server/services/host-service";

type PageProps = { params: Promise<{ userId: string }> };

/** One host: their full profile (shown to guests or not), contact details and every business they own. */
export default async function AdminHostPage({ params }: PageProps) {
  const { userId } = await params;
  const user = await requirePageUser();
  const [t, tLang, tPlans, locale, host] = await Promise.all([
    getTranslations("admin.hosts"),
    getTranslations("listing.languages"),
    getTranslations("plans.names"),
    getLocale(),
    findPageOr404(getHost(user, userId)),
  ]);
  const profile = host.hostProfile;
  const businesses = host.memberships.map((membership) => membership.business);
  const facts: Array<[string, string | null | undefined]> = [
    [t("email"), host.email],
    [t("phone"), profile?.phone ?? host.phone],
    [t("whatsapp"), profile?.whatsapp],
    [t("city"), profile?.city],
    [t("languages"), profile?.languages.map((code) => tLang(code as "ar" | "en" | "fr")).join(", ")],
    [t("hostingSince"), profile?.hostingSince?.toString()],
    [t("joined"), formatDate(host.createdAt, locale)],
  ];

  return (
    <>
      <PageHeader
        title={profile?.displayName ?? host.name}
        intro={profile?.displayName ? host.name : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel
          title={t("profile")}
          action={
            <span
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                profile?.showOnListings ? "bg-success/15 text-success" : "bg-surface-2 text-muted",
              )}
            >
              {profile?.showOnListings ? t("shown") : t("hidden")}
            </span>
          }
        >
          <dl className="grid gap-3 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="min-w-0 font-medium break-words">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {profile?.bio && (
            <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          )}
          {!profile && <p className="mt-4 text-sm text-muted">{t("noProfile")}</p>}
        </Panel>

        <Panel title={t("theirBusinesses", { count: businesses.length })}>
          <ul className="grid gap-3">
            {businesses.map((business) => (
              <li
                key={business.id}
                className={clsx(
                  "rounded-lg p-4 ring-1 ring-line",
                  business.status === "SUSPENDED" && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{business.name}</p>
                    <p className="text-sm text-muted">
                      {[business.area, tPlans(business.plan), formatDate(business.createdAt, locale)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("counts", {
                        rooms: business._count.rooms,
                        offerings: business._count.offerings,
                        bookings: business._count.bookings,
                        team: business._count.memberships,
                      })}
                    </p>
                  </div>
                  <BusinessStatusToggle
                    businessId={business.id}
                    businessName={business.name}
                    suspended={business.status === "SUSPENDED"}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/${business.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
                  >
                    <LayoutDashboard className="size-4" aria-hidden />
                    {t("openDashboard")}
                  </Link>
                  <Link
                    href={`/p/${business.slug}`}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    {t("openPage")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
