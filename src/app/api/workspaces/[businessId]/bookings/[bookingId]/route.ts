import { json, tenantRoute } from "@/server/http/route";
import { getBooking } from "@/server/services/booking-service";
import { bookingParams } from "@/server/validation/schemas";

export const GET = tenantRoute(bookingParams, async ({ ctx, params: { bookingId } }) => {
  return json(await getBooking(ctx, bookingId));
});
