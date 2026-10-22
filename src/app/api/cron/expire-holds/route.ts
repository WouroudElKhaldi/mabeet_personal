import { cleanUpRateLimits } from "@/server/http/rate-limit";
import { json, requireCronSecret, route } from "@/server/http/route";
import { expireAllStaleHolds } from "@/server/services/booking-service";
import { expireAllStaleSessionHolds } from "@/server/services/session-booking-service";

/** Expires unanswered holds on rooms and on experience or service sessions, and tidies old rate-limit windows. */
export const POST = route(async (request) => {
  requireCronSecret(request);
  const [stays, sessions] = await Promise.all([
    expireAllStaleHolds(),
    expireAllStaleSessionHolds(),
    cleanUpRateLimits(),
  ]);
  return json({ expired: stays + sessions, stays, sessions });
});
