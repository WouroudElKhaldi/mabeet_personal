import { z } from "zod";
import { notFound } from "@/server/errors";
import { parseParams, route } from "@/server/http/route";
import { getImage } from "@/server/services/photo-service";

const params = z.object({ imageId: z.string().regex(/^[a-z0-9]{10,40}$/) });

/** Serves an uploaded photo. Each upload gets a new id, so the bytes behind an id never change: cache forever. */
export const GET = route(async (_request, context) => {
  const { imageId } = await parseParams(context, params);
  const image = await getImage(imageId);
  if (!image) throw notFound("Image");
  return new Response(image.bytes, {
    headers: {
      "content-type": image.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});
