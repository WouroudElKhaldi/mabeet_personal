import { json, tenantRoute } from "@/server/http/route";
import { cancelPlanRequest } from "@/server/services/plan-request-service";
import { planRequestParams } from "@/server/validation/schemas";

/** Withdraws a request that is still waiting. */
export const DELETE = tenantRoute(planRequestParams, async ({ ctx, params }) => {
  await cancelPlanRequest(ctx, params.requestId);
  return json({ ok: true });
});
