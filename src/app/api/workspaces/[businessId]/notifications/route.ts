import { json, tenantRoute } from "@/server/http/route";
import {
  getLatestBusinessNotifications,
  markNotificationsSeen,
} from "@/server/services/notification-feed-service";
import { workspaceParams } from "@/server/validation/schemas";

/** The bell's card: the latest five notifications in this business, and when the person last read them. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  const { items, seenAt } = await getLatestBusinessNotifications(ctx);
  return json({ items, seenAt });
});

/** Opening the bell marks everything up to now as read. */
export const POST = tenantRoute(workspaceParams, async ({ ctx }) => {
  await markNotificationsSeen(ctx.userId);
  return json({ ok: true });
});
