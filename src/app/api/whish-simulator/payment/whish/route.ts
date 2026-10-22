import { json, parseBody, route } from "@/server/http/route";
import { createPayment, hasWhishHeaders } from "@/server/services/whish-simulator-service";
import { whishCreateBody } from "@/server/validation/schemas";

/** Simulated Whish Pay: create a payment and get its collectUrl. Answers HTTP 200 with Whish's envelope. */
export const POST = route(async (request) => {
  if (!hasWhishHeaders(request.headers)) return json({ status: false, code: "400", data: null });
  return json(await createPayment(await parseBody(request, whishCreateBody)));
});
