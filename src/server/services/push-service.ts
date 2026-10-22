import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { notFound } from "@/server/errors";
import { type PushDevice, type PushMessage, pushEnabled, sendPush } from "@/server/push/send";
import { findBookingByPublicToken } from "@/server/repositories/booking-repository";
import { findSessionBookingByToken } from "@/server/repositories/offering-repository";
import * as pushes from "@/server/repositories/push-repository";

// Push notifications mirror the emails: whoever gets an email about a booking also gets it on the devices
// they turned notifications on for. Delivery never throws, so a push outage cannot touch a booking.

/** The key browsers need to subscribe, or null when push is not set up. */
export const pushPublicKey = (): string | null => (pushEnabled() ? (env.VAPID_PUBLIC_KEY ?? null) : null);

export function followAsUser(userId: string, device: PushDevice): Promise<void> {
  return pushes.saveSubscription(prisma, { userId }, device);
}

/** A guest without an account follows one booking. The private link is their key, as on the booking page. */
export async function followBooking(bookingToken: string, device: PushDevice): Promise<void> {
  const booking =
    (await findBookingByPublicToken(prisma, bookingToken)) ??
    (await findSessionBookingByToken(prisma, bookingToken));
  if (!booking) throw notFound("Booking");
  await pushes.saveSubscription(prisma, { bookingToken }, device);
}

export function unfollow(owner: pushes.PushOwner, endpoint: string): Promise<void> {
  return pushes.deleteSubscription(prisma, owner, endpoint);
}

type Delivery = { device: PushDevice & { id: string }; message: PushMessage };

async function deliver(deliveries: Delivery[]): Promise<void> {
  const results = await Promise.allSettled(
    deliveries.map(({ device, message }) => sendPush(device, message)),
  );
  const gone = deliveries.filter((_, index) => {
    const result = results[index];
    if (result?.status === "rejected") console.error("[push] delivery failed", result.reason);
    return result?.status === "fulfilled" && !result.value;
  });
  if (gone.length > 0)
    await pushes.deleteSubscriptions(
      prisma,
      gone.map(({ device }) => device.id),
    );
}

/** Pushes to every device of these people, each message written in its owner's language. */
export async function pushToPeople(userIds: string[], build: (locale: string | null) => PushMessage) {
  if (!pushEnabled() || userIds.length === 0) return;
  const devices = await pushes.listUserDevices(prisma, userIds);
  await deliver(devices.map(({ locale, ...device }) => ({ device, message: build(locale) })));
}

/** Pushes to the devices following a booking, and to the guest's account if they booked signed in. */
export async function pushToGuest(bookingToken: string, guestUserId: string | null, message: PushMessage) {
  if (!pushEnabled()) return;
  const devices = await pushes.listBookingDevices(prisma, bookingToken, guestUserId);
  await deliver(devices.map((device) => ({ device, message })));
}
