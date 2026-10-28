import type { ReviewStatus } from "@prisma/client";
import { todayUtc } from "@/lib/dates";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as reviews from "@/server/repositories/review-repository";
import { recordAction } from "./audit";
import { duplicateAsConflict } from "./constraint-errors";

export interface ReviewInput {
  bookingId?: string;
  sessionBookingId?: string;
  rating: number;
  cleanliness?: number;
  location?: number;
  value?: number;
  comment: string;
}

/** Finds what is being reviewed and checks it is the author's, confirmed, finished and not yet reviewed. */
async function reviewTarget(userId: string, input: ReviewInput, now: Date) {
  if (input.sessionBookingId) {
    const booking = await reviews.findReviewableSessionBooking(prisma, userId, input.sessionBookingId);
    if (!booking) throw notFound("Booking");
    if (booking.session.endsAt > now) throw invalid("You can review this experience after it ends");
    if (booking.review) throw conflict("You already reviewed this experience");
    return { businessId: booking.businessId, offeringId: booking.offeringId, sessionBookingId: booking.id };
  }
  const booking = input.bookingId && (await reviews.findReviewableBooking(prisma, userId, input.bookingId));
  if (!booking) throw notFound("Stay");
  if (booking.checkOut > todayUtc(now)) throw invalid("You can review this stay after check-out");
  if (booking.review) throw conflict("You already reviewed this stay");
  return { businessId: booking.businessId, roomId: booking.roomId, bookingId: booking.id };
}

/** Only the guest who stayed or took part may review, once, afterwards. That keeps ratings honest. */
export async function submitReview(userId: string, input: ReviewInput, now = new Date()) {
  const target = await reviewTarget(userId, input, now);
  const review = await duplicateAsConflict("You already reviewed this", () =>
    reviews.createReview(prisma, {
      rating: input.rating,
      cleanliness: input.cleanliness,
      location: input.location,
      value: input.value,
      comment: input.comment,
      ...target,
      authorId: userId,
    }),
  );
  await logActivity(prisma, {
    userId,
    businessId: target.businessId,
    action: "review.submitted",
    entity: "review",
    entityId: review.id,
  });
  return review;
}

export function listPublicReviews(businessId: string, take = 20) {
  return reviews.listPublishedReviews(prisma, businessId, take);
}

export function listOfferingReviews(offeringId: string, take = 20) {
  return reviews.listOfferingReviews(prisma, offeringId, take);
}

/** Every review of the business, stays and experiences alike, with what it is about and who wrote it. */
export async function listReviewsForTeam(ctx: TenantContext, status?: ReviewStatus) {
  requirePermission(ctx, "reviews.reply");
  const rows = await reviews.listBusinessReviews(prisma, ctx.businessId, status);
  return rows.map(({ room, offering, booking, sessionBooking, ...review }) => ({
    ...review,
    subject: room?.name ?? offering?.title ?? "",
    guestName: booking?.guestName ?? sessionBooking?.guestName ?? "",
    reference: booking?.reference ?? sessionBooking?.reference ?? "",
  }));
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
