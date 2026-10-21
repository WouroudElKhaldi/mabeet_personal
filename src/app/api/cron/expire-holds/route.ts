import { json, requireCronSecret, route } from "@/server/http/route";
import { expireAllStaleHolds } from "@/server/services/booking-service";

export const POST = route(async (request) => {
  requireCronSecret(request);
  return json({ expired: await expireAllStaleHolds() });
});
