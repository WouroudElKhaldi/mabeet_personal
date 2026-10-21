import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { listPayments, recordPayment } from "@/server/services/payment-service";
import { bookingParams, paymentInput } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId, bookingId } = await parseParams(context, bookingParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listPayments(ctx, bookingId));
});

export const POST = route(async (request, context) => {
  const { businessId, bookingId } = await parseParams(context, bookingParams);
  const ctx = await requireTenant(request, businessId);
  const input = await parseBody(request, paymentInput);
  return json(await recordPayment(ctx, { ...input, bookingId, note: input.note ?? null }), 201);
});
