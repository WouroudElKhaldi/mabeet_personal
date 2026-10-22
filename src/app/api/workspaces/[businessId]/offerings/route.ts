import { json, parseBody, tenantRoute } from "@/server/http/route";
import { createOffering, listOfferings } from "@/server/services/offering-service";
import { offeringInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listOfferings(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createOffering(ctx, await parseBody(request, offeringInput)), 201);
});
