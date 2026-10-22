import { json, tenantRoute } from "@/server/http/route";
import { openBillingPortal } from "@/server/services/billing-service";
import { workspaceParams } from "@/server/validation/schemas";

/** Stripe's billing portal, to change plan, update the card or cancel. Owners only. */
export const POST = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json({ url: await openBillingPortal(ctx) });
});
