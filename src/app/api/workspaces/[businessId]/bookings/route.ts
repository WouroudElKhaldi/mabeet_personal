import { parseIsoDate } from "@/lib/dates";
import { json, parseParams, parseQuery, requireTenant, route } from "@/server/http/route";
import { listBookings } from "@/server/services/booking-service";
import { bookingFilters, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  const { from, to, ...filters } = parseQuery(request, bookingFilters);
  return json(
    await listBookings(ctx, {
      ...filters,
      from: from ? parseIsoDate(from) : undefined,
      to: to ? parseIsoDate(to) : undefined,
    }),
  );
});
