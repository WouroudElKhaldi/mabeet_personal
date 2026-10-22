import { z } from "zod";
import { json, optionalUser, parseBody, parseParams, route } from "@/server/http/route";
import { requestLocale } from "@/server/http/error-i18n";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { requestSessionBooking } from "@/server/services/session-booking-service";
import { sessionBookingRequest } from "@/server/validation/schemas";

const params = z.object({ slug: z.string().min(1).max(80) });

// Like stays: every request holds seats, so a script must not be able to hold a whole session.
const REQUESTS_PER_ADDRESS = 5;
const REQUESTS_PER_PHONE = 3;
const WINDOW_MS = 60 * 60_000;

export const POST = route(async (request, context) => {
  await enforceRateLimit(`session-booking:ip:${clientAddress(request)}`, REQUESTS_PER_ADDRESS, WINDOW_MS);
  const { slug } = await parseParams(context, params);
  const input = await parseBody(request, sessionBookingRequest);
  await enforceRateLimit(`session-booking:phone:${input.guestPhone}`, REQUESTS_PER_PHONE, WINDOW_MS);
  const user = await optionalUser(request);
  const booking = await requestSessionBooking({
    offeringSlug: slug,
    sessionId: input.sessionId,
    seats: input.seats,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    guestEmail: input.guestEmail ?? null,
    guestNote: input.guestNote ?? null,
    guestUserId: user?.id ?? null,
    locale: requestLocale(request),
  });
  return json(
    {
      reference: booking.reference,
      status: booking.status,
      publicToken: booking.publicToken,
      totalCents: booking.totalCents,
      depositCents: booking.depositCents,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
    },
    201,
  );
});
