import { cleanUpRateLimits } from "@/server/http/rate-limit";
import { json, requireCronSecret, route } from "@/server/http/route";
import { runPlanHousekeeping } from "@/server/services/billing-service";
import { expireAllStaleHolds } from "@/server/services/booking-service";
import { reconcilePendingPayments } from "@/server/services/online-payment-service";
import { expireAllStaleSessionHolds } from "@/server/services/session-booking-service";

/**
 * Housekeeping: expires unanswered or unpaid bookings on rooms and sessions, re-checks online payments whose
 * callback never came, ends Whish plan months that ran out, and tidies old rate-limit windows.
 */
export const POST = route(async (request) => {
  requireCronSecret(request);
  // Payments first: a guest who paid just before the deadline is confirmed rather than expired.
  const payments = await reconcilePendingPayments();
  const [stays, sessions, plans] = await Promise.all([
    expireAllStaleHolds(),
    expireAllStaleSessionHolds(),
    runPlanHousekeeping(),
    cleanUpRateLimits(),
  ]);
  return json({ expired: stays + sessions, stays, sessions, payments, plans });
});
