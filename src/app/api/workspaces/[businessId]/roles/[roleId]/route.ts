import { json, parseBody, tenantRoute } from "@/server/http/route";
import { deleteRole, updateRole } from "@/server/services/team-service";
import { roleInput, roleParams } from "@/server/validation/schemas";

export const PATCH = tenantRoute(roleParams, async ({ request, ctx, params: { roleId } }) => {
  await updateRole(ctx, roleId, await parseBody(request, roleInput.partial()));
  return json({ ok: true });
});

export const DELETE = tenantRoute(roleParams, async ({ ctx, params: { roleId } }) => {
  await deleteRole(ctx, roleId);
  return json({ ok: true });
});
