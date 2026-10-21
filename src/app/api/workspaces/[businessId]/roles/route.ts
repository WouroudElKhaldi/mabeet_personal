import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { createRole, listRoles } from "@/server/services/team-service";
import { roleInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listRoles(ctx));
});

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await createRole(ctx, await parseBody(request, roleInput)), 201);
});
