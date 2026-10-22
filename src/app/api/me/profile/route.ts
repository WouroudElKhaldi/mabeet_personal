import { json, parseBody, requireUser, route } from "@/server/http/route";
import { updateMyProfile } from "@/server/services/account-service";
import { profileInput } from "@/server/validation/schemas";

/** The signed-in person changes their own name and phone. */
export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  await updateMyProfile(user.id, await parseBody(request, profileInput));
  return json({ ok: true });
});
