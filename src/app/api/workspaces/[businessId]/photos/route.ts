import { z } from "zod";
import { invalid } from "@/server/errors";
import { json, tenantRoute } from "@/server/http/route";
import { uploadPhoto } from "@/server/services/photo-service";
import { workspaceParams } from "@/server/validation/schemas";
import { PHOTO_AREAS } from "@/config/enums";

const fields = z.object({
  offeringId: z.string().min(1).max(64).nullable(),
  roomId: z.string().min(1).max(64).nullable(),
  alt: z.string().trim().max(160).nullable(),
  area: z.enum(PHOTO_AREAS).nullable(),
});

/** Multipart upload: `file`, and `offeringId` or `roomId` for an experience's or a room's photo (neither for the place). */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const form = await request.formData().catch(() => {
    throw invalid("Send the photo as multipart form data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw invalid("Choose a photo to upload");
  const target = fields.parse({
    offeringId: (form.get("offeringId") as string | null) || null,
    roomId: (form.get("roomId") as string | null) || null,
    alt: (form.get("alt") as string | null) || null,
    area: (form.get("area") as string | null) || null,
  });
  const photo = await uploadPhoto(ctx, { ...target, bytes: new Uint8Array(await file.arrayBuffer()) });
  return json(photo, 201);
});
