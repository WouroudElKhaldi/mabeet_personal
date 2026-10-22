import { json, parseBody, tenantRoute } from "@/server/http/route";
import { getSettings, updateSettings } from "@/server/services/settings-service";
import { settingsInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await getSettings(ctx));
});

export const PATCH = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await updateSettings(ctx, await parseBody(request, settingsInput));
  return json({ ok: true });
});
