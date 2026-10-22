import { z } from "zod";
import { toDateRange } from "@/lib/dates";
import { json, optionalUser, parseBody, parseParams, route } from "@/server/http/route";
import { requestLocale } from "@/server/http/error-i18n";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { requestBooking } from "@/server/services/booking-service";
import { bookingRequest } from "@/server/validation/schemas";

const params = z.object({ slug: z.string().min(1).max(64) });

// Every request holds a room for hours, so a script must not be able to hold a whole guesthouse.
const REQUESTS_PER_ADDRESS = 5;
const REQUESTS_PER_PHONE = 3;
const WINDOW_MS = 60 * 60_000;

export const POST = route(async (request, context) => {
  await enforceRateLimit(`booking:ip:${clientAddress(request)}`, REQUESTS_PER_ADDRESS, WINDOW_MS);
  const { slug } = await parseParams(context, params);
  const input = await parseBody(request, bookingRequest);
  await enforceRateLimit(`booking:phone:${input.guestPhone}`, REQUESTS_PER_PHONE, WINDOW_MS);
  const user = await optionalUser(request);
  const booking = await requestBooking({
    businessSlug: slug,
    roomId: input.roomId,
    range: toDateRange(input),
    guestCount: input.guestCount,
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
