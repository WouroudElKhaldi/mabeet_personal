import { z } from "zod";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";
import { startBookingCheckout } from "@/server/services/online-payment-service";
import { bookingCheckoutInput } from "@/server/validation/schemas";

const params = z.object({ token: z.string().min(20).max(64) });

/** The guest pays a booking online, with Whish or a card. Returns the Whish or Stripe page to go to. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`checkout:${clientAddress(request)}`, 20, 60 * 60_000);
  const { token } = await parseParams(context, params);
  const { method } = await parseBody(request, bookingCheckoutInput);
  return json({ url: await startBookingCheckout(token, method) });
});
