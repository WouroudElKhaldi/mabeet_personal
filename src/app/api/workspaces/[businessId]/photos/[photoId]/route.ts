import { z } from "zod";
import { PHOTO_AREAS } from "@/config/enums";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { describePhoto, removePhoto, setCoverPhoto } from "@/server/services/photo-service";
import { workspaceParams } from "@/server/validation/schemas";

const params = workspaceParams.extend({ photoId: z.string().min(1).max(64) });

const photoChange = z.union([
  z.object({ cover: z.literal(true) }),
  z.object({ area: z.enum(PHOTO_AREAS).nullable().optional(), alt: z.string().trim().max(160).nullish() }),
]);

/** `{ "cover": true }` makes this photo the first one shown; `{ area, alt }` tags it for the photo tour. */
export const PATCH = tenantRoute(params, async ({ request, ctx, params: { photoId } }) => {
  const change = await parseBody(request, photoChange);
  if ("cover" in change) await setCoverPhoto(ctx, photoId);
  else await describePhoto(ctx, photoId, change);
  return json({ ok: true });
});

export const DELETE = tenantRoute(params, async ({ ctx, params: { photoId } }) => {
  await removePhoto(ctx, photoId);
  return json({ ok: true });
});
