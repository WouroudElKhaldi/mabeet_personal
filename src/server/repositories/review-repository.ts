import type { ReviewStatus } from "@prisma/client";
import type { Db } from "@/server/db/client";

const PUBLIC_REVIEW = {
  id: true,
  rating: true,
  comment: true,
  ownerReply: true,
  createdAt: true,
  author: { select: { name: true } },
  room: { select: { name: true } },
} as const;

/** Reviews of a place's stays. Experiences and services have their own (listOfferingReviews). */
export function listPublishedReviews(db: Db, businessId: string, take: number) {
  return db.review.findMany({
    where: { businessId, offeringId: null, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: PUBLIC_REVIEW,
  });
}

export function listOfferingReviews(db: Db, offeringId: string, take: number) {
  return db.review.findMany({
    where: { offeringId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: PUBLIC_REVIEW,
  });
}

export function listBusinessReviews(db: Db, businessId: string, status?: ReviewStatus) {
  return db.review.findMany({
    where: { businessId, status },
    orderBy: { createdAt: "desc" },
    include: {
      room: { select: { name: true } },
      offering: { select: { title: true } },
      booking: { select: { reference: true, guestName: true } },
      sessionBooking: { select: { reference: true, guestName: true } },
    },
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

/** Seats the guest held in a session, confirmed; reviewable once the session has ended. */
export function findReviewableSessionBooking(db: Db, guestUserId: string, sessionBookingId: string) {
  return db.sessionBooking.findFirst({
    where: { id: sessionBookingId, guestUserId, status: "CONFIRMED" },
    select: {
      id: true,
      businessId: true,
      offeringId: true,
      session: { select: { endsAt: true } },
      review: { select: { id: true } },
    },
  });
}

export function createReview(
  db: Db,
  review: {
    businessId: string;
    roomId?: string;
    bookingId?: string;
    offeringId?: string;
    sessionBookingId?: string;
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
