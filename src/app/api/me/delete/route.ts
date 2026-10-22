import { z } from "zod";
import { json, parseBody, requireUser, route } from "@/server/http/route";
import { deleteMyAccount } from "@/server/services/account-service";

/** Deletes the signed-in person's account. The body repeats their email as confirmation. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { email } = await parseBody(request, z.object({ email: z.string().max(254) }));
  await deleteMyAccount(user, email);
  return json({ ok: true });
});
