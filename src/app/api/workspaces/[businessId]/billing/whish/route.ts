import { json, parseBody, tenantRoute } from "@/server/http/route";
import { startWhishPlanCheckout } from "@/server/services/billing-service";
import { checkoutInput, workspaceParams } from "@/server/validation/schemas";

/** Pays one month of a plan with Whish. Owners only; returns the Whish page to send them to. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { plan } = await parseBody(request, checkoutInput);
  return json({ url: await startWhishPlanCheckout(ctx, plan) });
});
