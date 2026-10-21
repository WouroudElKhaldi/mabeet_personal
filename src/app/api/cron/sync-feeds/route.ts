import { json, requireCronSecret, route } from "@/server/http/route";
import { syncDueFeeds } from "@/server/services/calendar-service";

export const POST = route(async (request) => {
  requireCronSecret(request);
  return json(await syncDueFeeds());
});
