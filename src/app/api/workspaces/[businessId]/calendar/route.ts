import { toDateRange } from "@/lib/dates";
import { json, parseParams, parseQuery, requireTenant, route } from "@/server/http/route";
import { getCalendar } from "@/server/services/calendar-service";
import { calendarQuery, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  const { from, to, roomId } = parseQuery(request, calendarQuery);
  return json(await getCalendar(ctx, toDateRange({ checkIn: from, checkOut: to }), roomId));
});
