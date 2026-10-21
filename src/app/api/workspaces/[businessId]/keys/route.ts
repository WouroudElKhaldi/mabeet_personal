import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { createKey, listKeys } from "@/server/services/api-key-service";
import { keyInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listKeys(ctx));
});

/** The response carries the secret once; it is never shown again. */
export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await createKey(ctx, await parseBody(request, keyInput)), 201);
});
