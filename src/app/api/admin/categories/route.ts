import { json, parseBody, requireUser, route } from "@/server/http/route";
import { createCategory, listCategoriesForAdmin } from "@/server/services/admin-service";
import { categoryInput } from "@/server/validation/schemas";

export const GET = route(async (request) => {
  return json(await listCategoriesForAdmin(await requireUser(request)));
});

/** Super admins add browse categories for homes, experiences or services. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await createCategory(user, await parseBody(request, categoryInput));
  return json({ ok: true }, 201);
});
