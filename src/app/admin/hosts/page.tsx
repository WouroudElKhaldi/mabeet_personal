import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { formatDate } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { listHosts } from "@/server/services/host-service";

/** Every host once, however many businesses they own. Open one to see their profile and businesses. */
export default async function AdminHostsPage() {
  const user = await requirePageUser();
  const [t, locale, hosts] = await Promise.all([
    getTranslations("admin.hosts"),
    getLocale(),
    listHosts(user),
  ]);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro", { count: hosts.length })} />
      <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-start">{t("host")}</th>
              <th className="px-4 py-3 text-start">{t("phone")}</th>
              <th className="px-4 py-3 text-start">{t("businesses")}</th>
              <th className="px-4 py-3 text-end">{t("bookings")}</th>
              <th className="px-4 py-3 text-start">{t("since")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hosts.map((host) => {
              const businesses = host.memberships.map((membership) => membership.business);
              const bookings = businesses.reduce((sum, business) => sum + business._count.bookings, 0);
              const suspended = businesses.filter((business) => business.status === "SUSPENDED").length;
              return (
                <tr key={host.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/admin/hosts/${host.id}`} className="font-semibold hover:underline">
                      {host.name}
                    </Link>
                    <p className="text-xs text-muted">{host.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{host.hostProfile?.phone ?? host.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold tabular-nums">{businesses.length}</span>
                    <span className="ms-2 text-xs text-muted">
                      {businesses
                        .slice(0, 2)
                        .map((business) => business.name)
                        .join(", ")}
                      {businesses.length > 2 && ` +${businesses.length - 2}`}
                    </span>
                    {suspended > 0 && (
                      <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                        {t("suspended", { count: suspended })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{bookings}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(host.createdAt, locale)}</td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/admin/hosts/${host.id}`}
                      aria-label={t("open", { name: host.name })}
                      className="inline-grid size-8 place-items-center rounded-full hover:bg-surface"
                    >
                      <ChevronRight className="size-4 text-muted rtl:rotate-180" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
