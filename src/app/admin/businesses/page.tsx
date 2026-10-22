import { clsx } from "clsx";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BusinessStatusToggle } from "@/components/dashboard/business-status-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { formatDate } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { getPlatformOverview } from "@/server/services/admin-service";

/** Every business on the platform, with suspend and reactivate. */
export default async function AdminBusinessesPage() {
  const user = await requirePageUser();
  const [t, locale, { businesses }] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    getPlatformOverview(user),
  ]);
  return (
    <>
      <PageHeader title={t("nav.businesses")} intro={t("businessesIntro")} />
      <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
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
                  {business.listedPublicly && <span className="ms-2 text-xs text-accent">{t("listed")}</span>}
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
    </>
  );
}
