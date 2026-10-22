import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { deleteCategory, updateCategory } from "@/server/services/admin-service";
import { categoryParams, categoryUpdate } from "@/server/validation/schemas";

export const PATCH = route(async (request, context) => {
  const user = await requireUser(request);
  const { slug } = await parseParams(context, categoryParams);
  await updateCategory(user, slug, await parseBody(request, categoryUpdate));
  return json({ ok: true });
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request);
  const { slug } = await parseParams(context, categoryParams);
  await deleteCategory(user, slug);
  return json({ ok: true });
});
