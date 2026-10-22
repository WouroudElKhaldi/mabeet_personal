import { json, parseBody, tenantRoute } from "@/server/http/route";
import { addMember, listMembers } from "@/server/services/team-service";
import { memberInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listMembers(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await addMember(ctx, await parseBody(request, memberInput)), 201);
});
