import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { getSettings, updateSettings } from "@/server/services/settings-service";
import { settingsInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await getSettings(ctx));
});

export const PATCH = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  await updateSettings(ctx, await parseBody(request, settingsInput));
  return json({ ok: true });
});
