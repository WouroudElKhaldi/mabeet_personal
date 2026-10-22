import { json, parseBody, tenantRoute } from "@/server/http/route";
import { startCheckout } from "@/server/services/billing-service";
import { checkoutInput, workspaceParams } from "@/server/validation/schemas";

/** Starts Stripe Checkout for a paid plan. Owners only; returns the page to send them to. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { plan } = await parseBody(request, checkoutInput);
  return json({ url: await startCheckout(ctx, plan) });
});
