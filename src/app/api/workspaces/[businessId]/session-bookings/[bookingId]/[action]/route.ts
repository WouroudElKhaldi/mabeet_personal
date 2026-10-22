import { z } from "zod";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import {
  cancelSessionBooking,
  confirmSessionBooking,
  declineSessionBooking,
} from "@/server/services/session-booking-service";
import { decision, sessionBookingParams } from "@/server/validation/schemas";

const params = sessionBookingParams.extend({ action: z.enum(["confirm", "decline", "cancel"]) });

export const POST = tenantRoute(params, async ({ request, ctx, params: { bookingId, action } }) => {
  const { reason } = await parseBody(request, decision);
  const booking =
    action === "confirm"
      ? await confirmSessionBooking(ctx, bookingId)
      : action === "decline"
        ? await declineSessionBooking(ctx, bookingId, reason)
        : await cancelSessionBooking(ctx, bookingId, reason);
  return json({ id: booking.id, status: booking.status });
});
