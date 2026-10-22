import { z } from "zod";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { markRefundSent } from "@/server/services/payout-service";
import { refundSentInput } from "@/server/validation/schemas";

const params = z.object({ refundId: z.string().min(1).max(64) });

/** A platform admin sent a refund by hand (a partial Whish refund, or one the provider refused). */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  const { refundId } = await parseParams(context, params);
  const { reference } = await parseBody(request, refundSentInput);
  await markRefundSent(user, refundId, reference ?? null);
  return json({ ok: true });
});
