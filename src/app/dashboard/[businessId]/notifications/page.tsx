import { getTranslations } from "next-intl/server";
import { PhoneAlerts } from "@/components/pwa/phone-alerts";
import { NotificationList } from "@/components/shell/notification-list";
import { PageHeader } from "@/components/shell/page-header";
import { requirePageTenant } from "@/server/http/session";
import { getBusinessNotifications, markNotificationsSeen } from "@/server/services/notification-feed-service";
import { pushPublicKey } from "@/server/services/push-service";

type PageProps = { params: Promise<{ businessId: string }> };

/** What happened in this business that this member should know, and phone alerts for it. */
export default async function DashboardNotificationsPage({ params }: PageProps) {
  const ctx = await requirePageTenant((await params).businessId);
  const [t, tPwa, { items, seenAt }] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("pwa"),
    getBusinessNotifications(ctx),
  ]);
  // Read once shown: the list still marks what was new on this visit.
  await markNotificationsSeen(ctx.userId);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <NotificationList items={items} seenAt={seenAt} viewerId={ctx.userId} />
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
