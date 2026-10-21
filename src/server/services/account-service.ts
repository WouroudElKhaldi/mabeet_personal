import { prisma } from "@/server/db/client";
import { listUserActivity } from "@/server/repositories/activity-repository";

const ACTIVITY_PAGE = 50;

/** A guest's own timeline: requests, favourites, reviews. Only their own rows. */
export function listMyActivity(userId: string) {
  return listUserActivity(prisma, userId, ACTIVITY_PAGE);
}
