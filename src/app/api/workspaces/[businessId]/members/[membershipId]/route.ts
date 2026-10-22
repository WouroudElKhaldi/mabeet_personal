import { json, parseBody, tenantRoute } from "@/server/http/route";
import { changeMemberRole, removeMember } from "@/server/services/team-service";
import { memberParams, memberUpdate } from "@/server/validation/schemas";

export const PATCH = tenantRoute(memberParams, async ({ request, ctx, params: { membershipId } }) => {
  const { roleId } = await parseBody(request, memberUpdate);
  await changeMemberRole(ctx, membershipId, roleId);
  return json({ ok: true });
});

export const DELETE = tenantRoute(memberParams, async ({ ctx, params: { membershipId } }) => {
  await removeMember(ctx, membershipId);
  return json({ ok: true });
});
