import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { changeMemberRole, removeMember } from "@/server/services/team-service";
import { memberParams, memberUpdate } from "@/server/validation/schemas";

export const PATCH = route(async (request, context) => {
  const { businessId, membershipId } = await parseParams(context, memberParams);
  const ctx = await requireTenant(request, businessId);
  const { roleId } = await parseBody(request, memberUpdate);
  await changeMemberRole(ctx, membershipId, roleId);
  return json({ ok: true });
});

export const DELETE = route(async (request, context) => {
  const { businessId, membershipId } = await parseParams(context, memberParams);
  const ctx = await requireTenant(request, businessId);
  await removeMember(ctx, membershipId);
  return json({ ok: true });
});
