import { json, parseBody, tenantRoute } from "@/server/http/route";
import { recordSessionPayment } from "@/server/services/payment-service";
import { paymentInput, sessionBookingParams } from "@/server/validation/schemas";

export const POST = tenantRoute(sessionBookingParams, async ({ request, ctx, params: { bookingId } }) => {
  const input = await parseBody(request, paymentInput);
  return json(await recordSessionPayment(ctx, { ...input, bookingId, note: input.note ?? null }), 201);
});
