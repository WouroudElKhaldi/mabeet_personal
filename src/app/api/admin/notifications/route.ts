import { json, requireUser, route } from "@/server/http/route";
import {
  getLatestPlatformNotifications,
  markNotificationsSeen,
} from "@/server/services/notification-feed-service";

/** The admin bell's card: the latest five platform notifications. Platform admins only. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const { items, seenAt } = await getLatestPlatformNotifications(user);
  return json({ items, seenAt });
});

/** Opening the bell marks everything up to now as read. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await getLatestPlatformNotifications(user);
  await markNotificationsSeen(user.id);
  return json({ ok: true });
});
