import { toDateRange } from "@/lib/dates";
import { json, parseParams, parseQuery, route } from "@/server/http/route";
import { getTakenNights } from "@/server/services/directory-service";
import { availabilityQuery, publicRoomParams } from "@/server/validation/schemas";

/** Taken night ranges for a room's public calendar. Says nothing about who or why. */
export const GET = route(async (request, context) => {
  const { slug, roomId } = await parseParams(context, publicRoomParams);
  const { from, to } = parseQuery(request, availabilityQuery);
  return json(await getTakenNights(slug, roomId, toDateRange({ checkIn: from, checkOut: to })));
});
