import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, requireUser, route } from "@/server/http/route";
import { followAsUser, unfollow } from "@/server/services/push-service";
import { pushSubscribe, pushUnsubscribe } from "@/server/validation/schemas";

/** Turns on push notifications on this device for everything the signed-in person is told about. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await enforceRateLimit(`push:${clientAddress(request)}`, 20, 60 * 60_000);
  await followAsUser(user.id, await parseBody(request, pushSubscribe));
  return json({ ok: true }, 201);
});

export const DELETE = route(async (request) => {
  const user = await requireUser(request);
  const { endpoint } = await parseBody(request, pushUnsubscribe);
  await unfollow({ userId: user.id }, endpoint);
  return json({ ok: true });
});
