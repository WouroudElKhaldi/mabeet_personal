import { json, parseBody, requireUser, route } from "@/server/http/route";
import { setSitePalette } from "@/server/services/admin-service";
import { siteSettingsInput } from "@/server/validation/schemas";

/** Super admins choose the website's colour palette. */
export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  const { palette } = await parseBody(request, siteSettingsInput);
  await setSitePalette(user, palette);
  return json({ ok: true });
});
