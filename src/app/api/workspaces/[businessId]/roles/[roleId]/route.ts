import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { deleteRole, updateRole } from "@/server/services/team-service";
import { roleInput, roleParams } from "@/server/validation/schemas";

export const PATCH = route(async (request, context) => {
  const { businessId, roleId } = await parseParams(context, roleParams);
  const ctx = await requireTenant(request, businessId);
  await updateRole(ctx, roleId, await parseBody(request, roleInput.partial()));
  return json({ ok: true });
});

export const DELETE = route(async (request, context) => {
  const { businessId, roleId } = await parseParams(context, roleParams);
  const ctx = await requireTenant(request, businessId);
  await deleteRole(ctx, roleId);
  return json({ ok: true });
});
