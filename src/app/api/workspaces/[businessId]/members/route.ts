import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { addMember, listMembers } from "@/server/services/team-service";
import { memberInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listMembers(ctx));
});

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await addMember(ctx, await parseBody(request, memberInput)), 201);
});
