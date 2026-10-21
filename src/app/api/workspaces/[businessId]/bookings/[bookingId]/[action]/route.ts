import { z } from "zod";
import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { cancelBooking, confirmBooking, declineBooking } from "@/server/services/booking-service";
import { bookingParams, decision } from "@/server/validation/schemas";

const ACTIONS = { confirm: confirmBooking, decline: declineBooking, cancel: cancelBooking } as const;

const params = bookingParams.extend({ action: z.enum(["confirm", "decline", "cancel"]) });

export const POST = route(async (request, context) => {
  const { businessId, bookingId, action } = await parseParams(context, params);
  const ctx = await requireTenant(request, businessId);
  const { reason } = await parseBody(request, decision);
  const booking = await ACTIONS[action](ctx, { bookingId, reason });
  return json({ id: booking.id, status: booking.status });
});
