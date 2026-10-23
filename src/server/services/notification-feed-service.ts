import type { TenantContext } from "@/server/auth/tenant-context";
import { can } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as accounts from "@/server/repositories/account-repository";
import {
  countFeed,
  countFeedSince,
  type FeedScope,
  listFeed,
} from "@/server/repositories/activity-repository";
import { type PlatformActor, requireSuperAdmin } from "./admin-service";

// The bell: what happened that the person should know about, read from the activity log. Emails and push send
// the same news outward; this is the in-dashboard list. Settings saves and photo uploads are not news.

/** For people who handle bookings: requests, answers, cancellations and payments. */
const BOOKING_NEWS = [
  "booking.requested",
  "booking.confirmed",
  "booking.awaiting_payment",
  "booking.declined",
  "booking.cancelled",
  "booking.cancelled_by_guest",
  "payment.recorded",
  "payment.online_confirmed",
  "payment.online_late",
  "review.submitted",
] as const;

/** For owners: money and the team. */
const OWNER_NEWS = [
  "payout.requested",
  "plan.approved",
  "plan.rejected",
  "member.added",
  "member.removed",
  "member.role_changed",
] as const;

/** For platform admins: what needs them, across every business. */
const PLATFORM_NEWS = [
  "payout.requested",
  "plan.requested",
  "payment.online_late",
  "booking.requested",
  "review.submitted",
] as const;

const PAGE_SIZE = 20;

function businessNews(ctx: TenantContext): string[] {
  return [...(can(ctx, "bookings.read") ? BOOKING_NEWS : []), ...(ctx.isOwner ? OWNER_NEWS : [])];
}

async function seenAt(userId: string) {
  return (await accounts.findProfile(prisma, userId))?.notificationsSeenAt ?? null;
}

/** One page of the feed, newest first; `page` starts at 1 and is clamped to the pages there are. */
async function feed(scope: FeedScope, actions: string[], userId: string, page: number, size = PAGE_SIZE) {
  if (actions.length === 0) return { items: [], seenAt: null, page: 1, pages: 1 };
  const total = await countFeed(prisma, scope, actions);
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pages);
  const [items, seen] = await Promise.all([
    listFeed(prisma, scope, actions, { take: size, skip: (current - 1) * size }),
    seenAt(userId),
  ]);
  return { items, seenAt: seen, page: current, pages };
}

export function getBusinessNotifications(ctx: TenantContext, page = 1) {
  return feed({ businessId: ctx.businessId }, businessNews(ctx), ctx.userId, page);
}

/** The bell's card: the latest few. */
const LATEST = 5;

export function getLatestBusinessNotifications(ctx: TenantContext) {
  return feed({ businessId: ctx.businessId }, businessNews(ctx), ctx.userId, 1, LATEST);
}

export function getLatestPlatformNotifications(actor: PlatformActor) {
  requireSuperAdmin(actor);
  return feed({ platform: true }, [...PLATFORM_NEWS], actor.id, 1, LATEST);
}

export async function countBusinessUnread(ctx: TenantContext): Promise<number> {
  const actions = businessNews(ctx);
  if (actions.length === 0) return 0;
  return countFeedSince(
    prisma,
    { businessId: ctx.businessId },
    actions,
    await seenAt(ctx.userId),
    ctx.userId,
  );
}

export function getPlatformNotifications(actor: PlatformActor, page = 1) {
  requireSuperAdmin(actor);
  return feed({ platform: true }, [...PLATFORM_NEWS], actor.id, page);
}

export async function countPlatformUnread(actor: PlatformActor): Promise<number> {
  requireSuperAdmin(actor);
  return countFeedSince(prisma, { platform: true }, [...PLATFORM_NEWS], await seenAt(actor.id), actor.id);
}

/** Opening the notifications marks everything up to now as read. */
export async function markNotificationsSeen(userId: string, now = new Date()): Promise<void> {
  await accounts.markNotificationsSeen(prisma, userId, now);
}
