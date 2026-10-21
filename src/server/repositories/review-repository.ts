import type { ReviewStatus } from "@prisma/client";
import type { Db } from "@/server/db/client";

export function listPublishedReviews(db: Db, businessId: string, take: number) {
  return db.review.findMany({
    where: { businessId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      ownerReply: true,
      createdAt: true,
      author: { select: { name: true } },
      room: { select: { name: true } },
    },
  });
}

export function listBusinessReviews(db: Db, businessId: string, status?: ReviewStatus) {
  return db.review.findMany({
    where: { businessId, status },
    orderBy: { createdAt: "desc" },
    include: { room: { select: { name: true } }, booking: { select: { reference: true, guestName: true } } },
  });
}

export async function setOwnerReply(db: Db, businessId: string, reviewId: string, ownerReply: string) {
  const { count } = await db.review.updateMany({ where: { id: reviewId, businessId }, data: { ownerReply } });
  return count > 0;
}

export async function setVisibility(
  db: Db,
  businessId: string,
  reviewId: string,
  visibility: { status: ReviewStatus; hiddenReason: string | null },
) {
  const { count } = await db.review.updateMany({ where: { id: reviewId, businessId }, data: visibility });
  return count > 0;
}

export function findReviewableBooking(db: Db, guestUserId: string, bookingId: string) {
  return db.booking.findFirst({
    where: { id: bookingId, guestUserId, status: "CONFIRMED" },
    select: { id: true, businessId: true, roomId: true, checkOut: true, review: { select: { id: true } } },
  });
}

export function createReview(
  db: Db,
  review: {
    businessId: string;
    roomId: string;
    bookingId: string;
    authorId: string;
    rating: number;
    cleanliness?: number;
    location?: number;
    value?: number;
    comment: string;
  },
) {
  return db.review.create({ data: review });
}
