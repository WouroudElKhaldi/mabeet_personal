import type { Db } from "@/server/db/client";
import type { PushDevice } from "@/server/push/send";

/** Who a device follows: a signed-in person, or one booking by its private link. */
export type PushOwner = { userId: string } | { bookingToken: string };

const device = { id: true, endpoint: true, p256dh: true, auth: true } as const;

/** Saves a device for an owner. Subscribing twice from the same device replaces the old keys. */
export async function saveSubscription(db: Db, owner: PushOwner, push: PushDevice): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { ...owner, endpoint: push.endpoint } });
  await db.pushSubscription.create({ data: { ...owner, ...push } });
}

export async function deleteSubscription(db: Db, owner: PushOwner, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { ...owner, endpoint } });
}

export async function deleteSubscriptions(db: Db, ids: string[]): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { id: { in: ids } } });
}

/** The devices of these people, each with its owner's language. */
export async function listUserDevices(db: Db, userIds: string[]) {
  const rows = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { ...device, user: { select: { locale: true } } },
  });
  return rows.map(({ user, ...row }) => ({ ...row, locale: user?.locale ?? null }));
}

/** The devices following one booking, plus those of the guest's account when they booked signed in. */
export function listBookingDevices(db: Db, bookingToken: string, guestUserId: string | null) {
  return db.pushSubscription.findMany({
    where: { OR: [{ bookingToken }, ...(guestUserId ? [{ userId: guestUserId }] : [])] },
    select: device,
  });
}
