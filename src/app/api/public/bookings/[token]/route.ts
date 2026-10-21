import { z } from "zod";
import { toIsoDate } from "@/lib/dates";
import { notFound } from "@/server/errors";
import { json, parseParams, route } from "@/server/http/route";
import { getBookingForGuest } from "@/server/services/booking-service";

const params = z.object({ token: z.string().min(20).max(64) });

/** The guest's confirmation page data. Only fields the guest already knows or needs. */
export const GET = route(async (_request, context) => {
  const { token } = await parseParams(context, params);
  const booking = await getBookingForGuest(token);
  if (!booking) throw notFound("Booking");
  return json({
    reference: booking.reference,
    status: booking.status,
    checkIn: toIsoDate(booking.checkIn),
    checkOut: toIsoDate(booking.checkOut),
    guestName: booking.guestName,
    guestCount: booking.guestCount,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    depositPaid: booking.payments.some((payment) => payment.status === "PAID"),
    currency: booking.currency,
    holdExpiresAt: booking.holdExpiresAt,
    room: { name: booking.room.name },
    place: {
      name: booking.business.name,
      slug: booking.business.slug,
      whatsapp: booking.business.whatsapp,
      depositInstructions: booking.business.depositInstructions,
      checkInTime: booking.business.checkInTime,
      checkOutTime: booking.business.checkOutTime,
    },
  });
});
