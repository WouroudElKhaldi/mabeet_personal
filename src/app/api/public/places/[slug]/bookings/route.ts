import { z } from "zod";
import { parseIsoDate } from "@/lib/dates";
import { json, optionalUser, parseBody, parseParams, route } from "@/server/http/route";
import { requestBooking } from "@/server/services/booking-service";
import { bookingRequest } from "@/server/validation/schemas";

const params = z.object({ slug: z.string().min(1).max(64) });

export const POST = route(async (request, context) => {
  const { slug } = await parseParams(context, params);
  const input = await parseBody(request, bookingRequest);
  const user = await optionalUser(request);
  const booking = await requestBooking({
    businessSlug: slug,
    roomId: input.roomId,
    range: { checkIn: parseIsoDate(input.checkIn), checkOut: parseIsoDate(input.checkOut) },
    guestCount: input.guestCount,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    guestEmail: input.guestEmail ?? null,
    guestNote: input.guestNote ?? null,
    guestUserId: user?.id ?? null,
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
