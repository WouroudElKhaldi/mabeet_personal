import { getLocale, getTranslations } from "next-intl/server";
import { Rating } from "@/components/ui/rating";
import { ShowAllDialog } from "@/components/ui/show-all-dialog";
import { formatDate } from "@/lib/format";

interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  ownerReply: string | null;
  createdAt: Date;
  author: { name: string } | null;
}

// The page shows the latest few; the rest open in a popup.
const SHOWN = 6;

/** Published guest reviews, with the host's reply under each. Shared by places, experiences and services. */
export async function ReviewList({
  reviews,
  rating,
  emptyLabel,
}: {
  /** Up to the 100 latest; the first few show on the page. */
  reviews: PublicReview[];
  rating: { average: number; count: number };
  /** Shown when there are no reviews; defaults to the wording for a stay. */
  emptyLabel?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("placePage"), getLocale()]);
  const item = (review: PublicReview) => (
    <li key={review.id}>
      <p className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-ink font-semibold text-paper">
          {(review.author?.name ?? "G").slice(0, 1)}
        </span>
        <span className="grid">
          <span className="font-semibold">{review.author?.name ?? t("guest")}</span>
          <span className="text-sm text-muted">
            {formatDate(review.createdAt, locale, { month: "long", year: "numeric" })}
          </span>
        </span>
      </p>
      <p className="mt-3 leading-relaxed">{review.comment}</p>
      {review.ownerReply && (
        <p className="mt-3 border-s-2 border-accent-line ps-4 text-sm text-muted">
          <span className="font-semibold text-ink">{t("hostReply")}</span> {review.ownerReply}
        </p>
      )}
    </li>
  );
  return (
    <section id="reviews" className="mt-12 scroll-mt-24 border-t border-line pt-12">
      <h2 className="flex items-center gap-3 text-[1.375rem] font-semibold">
        {t("reviews")}
        {rating.count > 0 && <Rating average={rating.average} count={rating.count} label="" />}
      </h2>
      {reviews.length === 0 ? (
        <p className="mt-4 text-muted">{emptyLabel ?? t("noReviews")}</p>
      ) : (
        <>
          <ul className="mt-6 grid gap-8 sm:grid-cols-2">{reviews.slice(0, SHOWN).map(item)}</ul>
          {reviews.length > SHOWN && (
            <ShowAllDialog label={t("showAllReviews", { count: rating.count })} title={t("reviews")}>
              <ul className="grid gap-8">{reviews.map(item)}</ul>
            </ShowAllDialog>
          )}
        </>
      )}
    </section>
  );
}
