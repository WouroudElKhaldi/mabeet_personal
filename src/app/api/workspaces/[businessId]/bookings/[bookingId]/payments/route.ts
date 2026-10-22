import { json, parseBody, tenantRoute } from "@/server/http/route";
import { listPayments, recordPayment } from "@/server/services/payment-service";
import { bookingParams, paymentInput } from "@/server/validation/schemas";

export const GET = tenantRoute(bookingParams, async ({ ctx, params: { bookingId } }) => {
  return json(await listPayments(ctx, bookingId));
});

export const POST = tenantRoute(bookingParams, async ({ request, ctx, params: { bookingId } }) => {
  const input = await parseBody(request, paymentInput);
  return json(await recordPayment(ctx, { ...input, bookingId, note: input.note ?? null }), 201);
});
