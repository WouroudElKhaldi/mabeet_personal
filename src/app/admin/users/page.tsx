import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { requirePageUser } from "@/server/http/session";
import { getPlatformOverview } from "@/server/services/admin-service";

/** The newest accounts on the platform: guests, hosts and staff. */
export default async function AdminUsersPage() {
  const user = await requirePageUser();
  const [t, { users }] = await Promise.all([getTranslations("admin"), getPlatformOverview(user)]);
  return (
    <>
      <PageHeader title={t("nav.users")} intro={t("usersIntro")} />
      <ul className="grid gap-2 sm:grid-cols-2">
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
    </>
  );
}
