import { json, parseParams, parseQuery, route } from "@/server/http/route";
import { getTakenNights } from "@/server/services/directory-service";
import { dateWindow, publicRoomParams } from "@/server/validation/schemas";

/** Taken night ranges for a room's public calendar. Says nothing about who or why. */
export const GET = route(async (request, context) => {
  const { slug, roomId } = await parseParams(context, publicRoomParams);
  return json(await getTakenNights(slug, roomId, parseQuery(request, dateWindow)));
});
