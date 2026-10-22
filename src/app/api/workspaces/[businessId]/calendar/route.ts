import { json, parseQuery, tenantRoute } from "@/server/http/route";
import { getCalendar } from "@/server/services/calendar-service";
import { calendarQuery, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { range, roomId } = parseQuery(request, calendarQuery);
  return json(await getCalendar(ctx, range, roomId));
});
