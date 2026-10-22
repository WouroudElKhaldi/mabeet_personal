import { getTranslations } from "next-intl/server";
import { PhoneAlerts } from "@/components/pwa/phone-alerts";
import { requirePageUser } from "@/server/http/session";
import { pushPublicKey } from "@/server/services/push-service";

/** One place for everyone (guests, hosts, staff, admins) to get their notifications on this phone. */
export default async function NotificationsPage() {
  await requirePageUser("/account/notifications");
  const t = await getTranslations("pwa");
  return (
    <PhoneAlerts api="/api/me/push" publicKey={pushPublicKey()} title={t("title")} body={t("accountBody")} />
  );
}
