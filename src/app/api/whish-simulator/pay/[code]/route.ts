import { z } from "zod";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";
import { pay } from "@/server/services/whish-simulator-service";
import { whishPayInput } from "@/server/validation/schemas";

const params = z.object({ code: z.string().min(4).max(32) });

/** The simulated Whish payment page's "Pay" button: phone and one-time code. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`whish-sim:${clientAddress(request)}`, 30, 10 * 60_000);
  const { code } = await parseParams(context, params);
  const { phone, otp } = await parseBody(request, whishPayInput);
  return json(await pay(code, phone, otp));
});
