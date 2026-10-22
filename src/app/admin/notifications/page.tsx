import { getTranslations } from "next-intl/server";
import { PhoneAlerts } from "@/components/pwa/phone-alerts";
import { NotificationList } from "@/components/shell/notification-list";
import { PageHeader } from "@/components/shell/page-header";
import { requirePageUser } from "@/server/http/session";
import { getPlatformNotifications, markNotificationsSeen } from "@/server/services/notification-feed-service";
import { pushPublicKey } from "@/server/services/push-service";

/** What needs a platform admin across every business, and phone alerts. */
export default async function AdminNotificationsPage() {
  const user = await requirePageUser();
  const [t, tPwa, { items, seenAt }] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("pwa"),
    getPlatformNotifications(user),
  ]);
  await markNotificationsSeen(user.id);
  return (
    <>
      <PageHeader title={t("title")} intro={t("adminIntro")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <NotificationList items={items} seenAt={seenAt} viewerId={user.id} admin />
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
