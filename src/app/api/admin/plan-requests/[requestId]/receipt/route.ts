import { z } from "zod";
import { receiptResponse } from "@/server/http/receipt";
import { parseParams, requireUser, route } from "@/server/http/route";
import { getReceiptForAdmin } from "@/server/services/plan-request-service";

const params = z.object({ requestId: z.string().min(1).max(64) });

/** The receipt a host sent, for the admin deciding the request. */
export const GET = route(async (request, context) => {
  const user = await requireUser(request);
  const { requestId } = await parseParams(context, params);
  return receiptResponse(await getReceiptForAdmin(user, requestId));
});
