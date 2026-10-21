import { BedDouble, Clock, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingWidget } from "@/components/booking/booking-widget";
import { Amenity } from "@/components/place/amenity";
import { isAmenity } from "@/config/amenities";
import { CategoryIcon } from "@/components/place/category-icon";
import { FavoriteButton } from "@/components/place/favorite-button";
import { Gallery } from "@/components/place/gallery";
import { Rating } from "@/components/ui/rating";
import { formatDate, formatMoney } from "@/lib/format";
import { findPageOr404 } from "@/server/http/page";
import { getCurrentUser } from "@/server/http/session";
import { getPlace } from "@/server/services/directory-service";
import { favoriteSlugs } from "@/server/services/favorite-service";
import { listPublicReviews } from "@/server/services/review-service";
import { searchParams as searchSchema } from "@/server/validation/schemas";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const place = await findPageOr404(getPlace((await params).slug));
  return { title: place.name, description: place.description?.slice(0, 160) };
}

export default async function PlacePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const user = await getCurrentUser();
  const place = await findPageOr404(getPlace(slug));
  const [t, locale, reviews, saved] = await Promise.all([
    getTranslations("placePage"),
    getLocale(),
    listPublicReviews(place.id, 6),
    favoriteSlugs(user?.id),
  ]);
  const amenities = [...new Set(place.rooms.flatMap((room) => room.amenities))].filter(isAmenity);
  const photos = [...place.photos, ...place.rooms.flatMap((room) => room.photos)];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="rise-in text-4xl font-medium sm:text-5xl">{place.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <Rating average={place.rating.average} count={place.rating.count} label={t("newListing")} />
            {place.area && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {place.area}
              </span>
            )}
          </p>
        </div>
        <FavoriteButton slug={place.slug} initial={saved.has(place.slug)} signedIn={Boolean(user)} />
      </div>

      <Gallery photos={photos} seed={place.slug} name={place.name} />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="min-w-0">
          {place.categories.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {place.categories.map(({ category }) => (
                <li
                  key={category.slug}
                  className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold ring-1 ring-line"
                >
                  <CategoryIcon slug={category.slug} className="size-4 text-accent" />
                  {locale === "ar" ? category.nameAr : category.nameEn}
                </li>
              ))}
            </ul>
          )}
          {place.description && (
            <p className="mt-6 text-lg leading-relaxed whitespace-pre-line">{place.description}</p>
          )}

          <dl className="mt-8 grid gap-4 rounded-lg bg-surface p-5 ring-1 ring-line sm:grid-cols-3">
            <Fact icon={<Clock />} label={t("checkIn")} value={t("after", { time: place.checkInTime })} />
            <Fact icon={<Clock />} label={t("checkOut")} value={t("before", { time: place.checkOutTime })} />
            <Fact
              icon={<ShieldCheck />}
              label={t("deposit")}
              value={t("depositValue", { percent: place.depositPercent })}
            />
          </dl>

          <section className="mt-14">
            <h2 className="text-3xl font-medium">{t("rooms")}</h2>
            <ul className="mt-6 grid gap-4">
              {place.rooms.map((room) => (
                <li key={room.id} className="rounded-lg bg-surface p-5 ring-1 ring-line">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{room.name}</h3>
                    <p>
                      <span className="font-bold">
                        {formatMoney(room.baseRateCents, place.currency, locale)}
                      </span>{" "}
                      <span className="text-muted">{t("perNight")}</span>
                    </p>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden />
                      {t("sleeps", { count: room.capacity })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BedDouble className="size-4" aria-hidden />
                      {t("beds", { count: room.beds })}
                    </span>
                    {room.minNights > 1 && <span>{t("minNights", { count: room.minNights })}</span>}
                  </p>
                  {room.description && <p className="mt-3 leading-relaxed text-muted">{room.description}</p>}
                </li>
              ))}
            </ul>
          </section>

          {amenities.length > 0 && (
            <section className="mt-14">
              <h2 className="text-3xl font-medium">{t("amenities")}</h2>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {amenities.map((name) => (
                  <Amenity key={name} name={name} label={t(`amenity.${name}`)} />
                ))}
              </ul>
            </section>
          )}

          {(place.houseRules || place.cancellationPolicy) && (
            <section className="mt-14 grid gap-8 sm:grid-cols-2">
              {place.houseRules && <Policy title={t("houseRules")} body={place.houseRules} />}
              {place.cancellationPolicy && (
                <Policy title={t("cancellation")} body={place.cancellationPolicy} />
              )}
            </section>
          )}

          <section className="mt-14">
            <h2 className="text-3xl font-medium">{t("reviews")}</h2>
            {reviews.length === 0 ? (
              <p className="mt-4 text-muted">{t("noReviews")}</p>
            ) : (
              <ul className="mt-6 grid gap-8 sm:grid-cols-2">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <p className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-display font-semibold text-accent">
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
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {place.rooms.length > 0 ? (
            <BookingWidget
              slug={place.slug}
              currency={place.currency}
              rooms={place.rooms}
              initial={{ checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests }}
            />
          ) : (
            <p className="rounded-xl bg-surface p-6 text-muted ring-1 ring-line">{t("noRooms")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:text-accent">
      {icon}
      <div>
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed whitespace-pre-line text-muted">{body}</p>
    </div>
  );
}
