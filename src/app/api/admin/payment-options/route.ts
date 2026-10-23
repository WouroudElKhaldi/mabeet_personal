import { json, parseBody, requireUser, route } from "@/server/http/route";
import { addPaymentOption, listAllPaymentOptions } from "@/server/services/plan-request-service";
import { paymentOptionInput } from "@/server/validation/schemas";

/** The ways hosts can pay Mabeet by hand: bank accounts, Whish or OMT numbers, crypto wallets, cash. */
export const GET = route(async (request) => json(await listAllPaymentOptions(await requireUser(request))));

export const POST = route(async (request) => {
  const user = await requireUser(request);
  return json(await addPaymentOption(user, await parseBody(request, paymentOptionInput)), 201);
});
