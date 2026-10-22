import { getTranslations } from "next-intl/server";
import { PhoneAlerts } from "@/components/pwa/phone-alerts";
import { NotificationList } from "@/components/shell/notification-list";
import { PageHeader } from "@/components/shell/page-header";
import { Pagination } from "@/components/shell/pagination";
import { requirePageTenant } from "@/server/http/session";
import { getBusinessNotifications, markNotificationsSeen } from "@/server/services/notification-feed-service";
import { pushPublicKey } from "@/server/services/push-service";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ page?: string }>;
};

/** What happened in this business that this member should know, and phone alerts for it. */
export default async function DashboardNotificationsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const page = Number((await searchParams).page ?? 1) || 1;
  const [t, tPwa, { items, seenAt, page: current, pages }] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("pwa"),
    getBusinessNotifications(ctx, page),
  ]);
  // Read once shown: the list still marks what was new on this visit.
  if (current === 1) await markNotificationsSeen(ctx.userId);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <NotificationList items={items} seenAt={seenAt} viewerId={ctx.userId} />
          <Pagination
            page={current}
            pages={pages}
            href={(target) => `/dashboard/${businessId}/notifications?page=${target}`}
          />
        </div>
        <div className="h-fit">
          <PhoneAlerts
            api="/api/me/push"
            publicKey={pushPublicKey()}
            title={tPwa("title")}
            body={tPwa("accountBody")}
          />
        </div>
      </div>
    </>
  );
}
