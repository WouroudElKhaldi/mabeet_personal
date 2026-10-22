import { json, parseBody, tenantRoute } from "@/server/http/route";
import { getPayouts, requestPayout } from "@/server/services/payout-service";
import { payoutRequestInput, workspaceParams } from "@/server/validation/schemas";

/** What Mabeet holds for this business, its online payments and its payouts. Owners only. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => json(await getPayouts(ctx)));

/** Asks Mabeet to send money to the business's bank account or Whish number. Owners only. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const payout = await requestPayout(ctx, await parseBody(request, payoutRequestInput));
  return json({ payout }, 201);
});
