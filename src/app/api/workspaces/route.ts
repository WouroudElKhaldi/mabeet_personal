import { json, parseBody, requireUser, route } from "@/server/http/route";
import { createWorkspace } from "@/server/services/onboarding-service";
import { listWorkspaces } from "@/server/services/team-service";
import { workspaceInput } from "@/server/validation/schemas";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json(await listWorkspaces(user.id));
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = await parseBody(request, workspaceInput);
  return json(await createWorkspace(user.id, input), 201);
});
