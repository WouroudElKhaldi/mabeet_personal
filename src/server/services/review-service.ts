import type { ReviewStatus } from "@prisma/client";
import { todayUtc } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isUniqueViolation, prisma } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as reviews from "@/server/repositories/review-repository";
import { recordAction } from "./audit";

export interface ReviewInput {
  bookingId: string;
  rating: number;
  cleanliness?: number;
  location?: number;
  value?: number;
  comment: string;
}

/** Only the guest who stayed may review, once, after check-out. That keeps ratings honest. */
export async function submitReview(userId: string, input: ReviewInput, now = new Date()) {
  const booking = await reviews.findReviewableBooking(prisma, userId, input.bookingId);
  if (!booking) throw notFound("Stay");
  if (booking.checkOut > todayUtc(now)) throw invalid("You can review this stay after check-out");
  if (booking.review) throw conflict("You already reviewed this stay");
  try {
    const review = await reviews.createReview(prisma, {
      ...input,
      businessId: booking.businessId,
      roomId: booking.roomId,
      authorId: userId,
    });
    await logActivity(prisma, {
      userId,
      businessId: booking.businessId,
      action: "review.submitted",
      entity: "review",
      entityId: review.id,
    });
    return review;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("You already reviewed this stay");
    throw error;
  }
}

export function listPublicReviews(businessId: string, take = 20) {
  return reviews.listPublishedReviews(prisma, businessId, take);
}

export function listReviewsForTeam(ctx: TenantContext, status?: ReviewStatus) {
  requirePermission(ctx, "reviews.reply");
  return reviews.listBusinessReviews(prisma, ctx.businessId, status);
}

/** Owners can answer a review but never edit the guest's words. */
export async function replyToReview(ctx: TenantContext, reviewId: string, reply: string) {
  requirePermission(ctx, "reviews.reply");
  if (!(await reviews.setOwnerReply(prisma, ctx.businessId, reviewId, reply))) throw notFound("Review");
  await recordAction(ctx, "review.replied", "review", reviewId);
}

/** Hiding needs a reason and is logged, so a bad review cannot quietly disappear. */
export async function setReviewVisibility(ctx: TenantContext, reviewId: string, hiddenReason: string | null) {
  requirePermission(ctx, "reviews.reply");
  const status: ReviewStatus = hiddenReason ? "HIDDEN" : "PUBLISHED";
  if (!(await reviews.setVisibility(prisma, ctx.businessId, reviewId, { status, hiddenReason }))) {
    throw notFound("Review");
  }
  await recordAction(ctx, status === "HIDDEN" ? "review.hidden" : "review.published", "review", reviewId);
}
