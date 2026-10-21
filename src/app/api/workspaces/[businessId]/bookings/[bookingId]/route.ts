import { json, parseParams, requireTenant, route } from "@/server/http/route";
import { getBooking } from "@/server/services/booking-service";
import { bookingParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId, bookingId } = await parseParams(context, bookingParams);
  const ctx = await requireTenant(request, businessId);
  return json(await getBooking(ctx, bookingId));
});
