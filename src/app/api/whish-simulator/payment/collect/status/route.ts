import { json, parseBody, route } from "@/server/http/route";
import { collectStatus, hasWhishHeaders } from "@/server/services/whish-simulator-service";
import { whishReferenceBody } from "@/server/validation/schemas";

/** Simulated Whish Pay: a payment's collectStatus. */
export const POST = route(async (request) => {
  if (!hasWhishHeaders(request.headers)) return json({ status: false, code: "400", data: null });
  const { externalId } = await parseBody(request, whishReferenceBody);
  return json(await collectStatus(externalId));
});
