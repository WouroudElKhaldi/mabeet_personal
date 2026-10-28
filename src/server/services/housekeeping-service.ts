import { cleanUpRateLimits } from "@/server/http/rate-limit";
import { deleteStaleProgress } from "@/server/jobs/progress";
import { runPlanHousekeeping } from "./billing-service";
import { expireAllStaleHolds } from "./booking-service";
import { reconcilePendingPayments } from "./online-payment-service";
import { expireAllStaleSessionHolds } from "./session-booking-service";

/**
 * Housekeeping: expires unanswered or unpaid bookings on rooms and sessions, re-checks online payments whose
 * callback never came, ends Whish plan months that ran out, and tidies old rate-limit windows and the live
 * progress rows a crashed worker left behind. The worker runs it on a schedule; POST /api/cron/expire-holds runs
 * it on demand.
 */
export async function runHousekeeping() {
  // Payments first: a guest who paid just before the deadline is confirmed rather than expired.
  const payments = await reconcilePendingPayments();
  const [stays, sessions, plans] = await Promise.all([
    expireAllStaleHolds(),
    expireAllStaleSessionHolds(),
    runPlanHousekeeping(),
    cleanUpRateLimits(),
    deleteStaleProgress(),
  ]);
  return { expired: stays + sessions, stays, sessions, payments, plans };
}
