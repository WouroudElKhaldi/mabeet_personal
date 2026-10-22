import { z } from "zod";
import { notFound } from "@/server/errors";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";
import { cancelStayAsGuest } from "@/server/services/booking-service";
import { cancelSessionAsGuest } from "@/server/services/session-booking-service";

const params = z.object({ token: z.string().min(20).max(64) });
const body = z.object({ reason: z.string().trim().max(300).optional() });

/** The guest cancels a stay or a session booking. The private link is the guest's key, as on the page. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`guest-cancel:${clientAddress(request)}`, 10, 60 * 60_000);
  const { token } = await parseParams(context, params);
  const { reason } = await parseBody(request, body);
  const booking =
    (await cancelStayAsGuest(token, reason ?? null)) ?? (await cancelSessionAsGuest(token, reason ?? null));
  if (!booking) throw notFound("Booking");
  return json({ status: booking.status });
});
