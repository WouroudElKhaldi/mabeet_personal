import { json, parseParams, parseQuery, requireTenant, route } from "@/server/http/route";
import { getCalendar } from "@/server/services/calendar-service";
import { calendarQuery, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  const { range, roomId } = parseQuery(request, calendarQuery);
  return json(await getCalendar(ctx, range, roomId));
});
