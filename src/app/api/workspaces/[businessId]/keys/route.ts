import { json, parseBody, tenantRoute } from "@/server/http/route";
import { createKey, listKeys } from "@/server/services/api-key-service";
import { keyInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listKeys(ctx));
});

/** The response carries the secret once; it is never shown again. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createKey(ctx, await parseBody(request, keyInput)), 201);
});
