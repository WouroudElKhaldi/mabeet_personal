import { json, requireUser, route } from "@/server/http/route";
import { listMyBookings } from "@/server/services/booking-service";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json(await listMyBookings(user.id));
});
