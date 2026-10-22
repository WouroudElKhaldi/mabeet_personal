import { json, parseBody, tenantRoute } from "@/server/http/route";
import { createRole, listRoles } from "@/server/services/team-service";
import { roleInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listRoles(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createRole(ctx, await parseBody(request, roleInput)), 201);
});
