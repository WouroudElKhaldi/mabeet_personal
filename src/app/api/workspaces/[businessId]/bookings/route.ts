import { parseIsoDate } from "@/lib/dates";
import { json, parseQuery, tenantRoute } from "@/server/http/route";
import { listBookings } from "@/server/services/booking-service";
import { bookingFilters, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { from, to, ...filters } = parseQuery(request, bookingFilters);
  return json(
    await listBookings(ctx, {
      ...filters,
      from: from ? parseIsoDate(from) : undefined,
      to: to ? parseIsoDate(to) : undefined,
    }),
  );
});
