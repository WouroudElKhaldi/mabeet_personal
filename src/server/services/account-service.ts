import type { Locale } from "@/config/appearance";
import { prisma } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import * as accounts from "@/server/repositories/account-repository";
import { listUserActivity } from "@/server/repositories/activity-repository";

const ACTIVITY_PAGE = 50;

/** A guest's own timeline: requests, favourites, reviews. Only their own rows. */
export function listMyActivity(userId: string) {
  return listUserActivity(prisma, userId, ACTIVITY_PAGE);
}

/** "Download my data": everything held about this person, as plain JSON. */
export async function exportMyData(userId: string) {
  const data = await accounts.findMyData(prisma, userId);
  if (!data) throw notFound("Account");
  return { exportedAt: new Date().toISOString(), ...data };
}

/**
 * Deletes the signed-in person's account after they type their email. Refused while they are the only owner
 * of a business, so a place is never left without anyone who can run it.
 */
export async function deleteMyAccount(user: { id: string; email: string }, typedEmail: string) {
  if (typedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw invalid("Type your email exactly to confirm");
  }
  const soleOwned = await accounts.listSoleOwnedBusinesses(prisma, user.id);
  if (soleOwned.length > 0) {
    throw conflict(`You are the only owner of ${soleOwned.join(", ")}. Add another owner first.`);
  }
  await accounts.deleteUser(prisma, user.id);
}

/** The language this person's emails are written in. */
export function setMyLocale(userId: string, locale: Locale) {
  return accounts.setLocale(prisma, userId, locale);
}
