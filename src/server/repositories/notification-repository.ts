import type { Db } from "@/server/db/client";

// Read-only lookups for outgoing emails and push notifications.

export function findBookingForNotice(db: Db, bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: { select: { name: true } },
      guestUser: { select: { email: true } },
      business: {
        select: { id: true, name: true, depositInstructions: true, checkInTime: true, checkOutTime: true },
      },
    },
  });
}

export function findSessionBookingForNotice(db: Db, bookingId: string) {
  return db.sessionBooking.findUnique({
    where: { id: bookingId },
    include: {
      offering: { select: { title: true, meetingPoint: true } },
      session: { select: { startsAt: true } },
      guestUser: { select: { email: true } },
      business: { select: { id: true, name: true, depositInstructions: true, timezone: true } },
    },
  });
}

/** Active members who may confirm bookings (owners, and roles holding bookings.decide), with their language. */
export async function listBookingDeciders(
  db: Db,
  businessId: string,
): Promise<Array<{ id: string; email: string; locale: string }>> {
  const members = await db.membership.findMany({
    where: {
      businessId,
      status: "ACTIVE",
      role: { OR: [{ isOwner: true }, { permissions: { has: "bookings.decide" } }] },
    },
    select: { user: { select: { id: true, email: true, locale: true } } },
  });
  return [...new Map(members.map(({ user }) => [user.id, user])).values()];
}
