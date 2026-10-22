import { json, parseBody, tenantRoute } from "@/server/http/route";
import { updateOffering } from "@/server/services/offering-service";
import { offeringParams, offeringUpdate } from "@/server/validation/schemas";

export const PATCH = tenantRoute(offeringParams, async ({ request, ctx, params: { offeringId } }) => {
  await updateOffering(ctx, offeringId, await parseBody(request, offeringUpdate));
  return json({ ok: true });
});
