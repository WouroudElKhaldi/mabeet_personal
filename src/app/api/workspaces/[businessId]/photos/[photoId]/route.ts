import { z } from "zod";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { removePhoto, setCoverPhoto } from "@/server/services/photo-service";
import { workspaceParams } from "@/server/validation/schemas";

const params = workspaceParams.extend({ photoId: z.string().min(1).max(64) });

/** `{ "cover": true }` makes this photo the first one shown. */
export const PATCH = tenantRoute(params, async ({ request, ctx, params: { photoId } }) => {
  await parseBody(request, z.object({ cover: z.literal(true) }));
  await setCoverPhoto(ctx, photoId);
  return json({ ok: true });
});

export const DELETE = tenantRoute(params, async ({ ctx, params: { photoId } }) => {
  await removePhoto(ctx, photoId);
  return json({ ok: true });
});
