import { receiptResponse } from "@/server/http/receipt";
import { tenantRoute } from "@/server/http/route";
import { getReceiptForBusiness } from "@/server/services/plan-request-service";
import { planRequestParams } from "@/server/validation/schemas";

/** The receipt the owner sent with a request. */
export const GET = tenantRoute(planRequestParams, async ({ ctx, params }) =>
  receiptResponse(await getReceiptForBusiness(ctx, params.requestId)),
);
