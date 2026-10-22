import { getLocale, getTranslations } from "next-intl/server";
import { ReviewControls } from "@/components/dashboard/review-controls";
import { formatDate } from "@/lib/format";
import { requirePageAccess } from "@/server/http/session";
import { listReviewsForTeam } from "@/server/services/review-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function ReviewsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["reviews.reply"]);
  const [t, locale, reviews] = await Promise.all([
    getTranslations("dashboard.reviews"),
    getLocale(),
    listReviewsForTeam(ctx),
  ]);

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-4xl font-semibold">{t("title")}</h1>
      {reviews.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-center text-muted ring-1 ring-line">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="grid gap-3 rounded-lg bg-surface p-5 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {review.guestName}{" "}
                  <span className="text-sm font-normal text-muted">
                    · {review.subject} · {formatDate(review.createdAt, locale)}
                  </span>
                </p>
                <p
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-bold tabular-nums"
                  aria-label={t("rating", { rating: review.rating })}
                >
                  {review.rating}/5
                </p>
              </div>
              <p className="leading-relaxed">{review.comment}</p>
              {review.status === "HIDDEN" && (
                <p className="text-sm text-danger">
                  {t("hiddenBecause", { reason: review.hiddenReason ?? "" })}
                </p>
              )}
              <ReviewControls
                businessId={businessId}
                reviewId={review.id}
                reply={review.ownerReply}
                hidden={review.status === "HIDDEN"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
