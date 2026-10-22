import { z } from "zod";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";
import { followBooking, unfollow } from "@/server/services/push-service";
import { pushSubscribe, pushUnsubscribe } from "@/server/validation/schemas";

const params = z.object({ token: z.string().min(20).max(64) });

/** A guest without an account gets this booking's updates on this device. The private link is their key. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`push:${clientAddress(request)}`, 20, 60 * 60_000);
  const { token } = await parseParams(context, params);
  await followBooking(token, await parseBody(request, pushSubscribe));
  return json({ ok: true }, 201);
});

export const DELETE = route(async (request, context) => {
  const { token } = await parseParams(context, params);
  const { endpoint } = await parseBody(request, pushUnsubscribe);
  await unfollow({ bookingToken: token }, endpoint);
  return json({ ok: true });
});
