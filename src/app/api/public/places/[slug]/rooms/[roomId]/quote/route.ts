import { toDateRange } from "@/lib/dates";
import { json, parseParams, parseQuery, route } from "@/server/http/route";
import { quoteRoom } from "@/server/services/directory-service";
import { publicRoomParams, stayDates } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { slug, roomId } = await parseParams(context, publicRoomParams);
  const stay = parseQuery(request, stayDates);
  return json(await quoteRoom(slug, roomId, toDateRange(stay)));
});
