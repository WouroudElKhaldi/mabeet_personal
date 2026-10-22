import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { setBusinessStatus } from "@/server/services/admin-service";
import { businessStatusInput, workspaceParams } from "@/server/validation/schemas";

export const PATCH = route(async (request, context) => {
  const user = await requireUser(request);
  const { businessId } = await parseParams(context, workspaceParams);
  const { status } = await parseBody(request, businessStatusInput);
  await setBusinessStatus(user, businessId, status);
  return json({ ok: true });
});
