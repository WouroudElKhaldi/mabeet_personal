import {
  Accessibility,
  BedDouble,
  CalendarX2,
  Clock,
  DoorOpen,
  MapPin,
  ScrollText,
  ShieldCheck,
  UsersRound,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingWidget } from "@/components/booking/booking-widget";
import { Amenity } from "@/components/place/amenity";
import { isAmenity } from "@/config/amenities";
import { ACCESSIBILITY, keepKnown, TAGS } from "@/config/listing";
import { KnowList, type KnowItem, ThingsToKnow } from "@/components/listing/things-to-know";
import { ReviewList } from "@/components/listing/review-list";
import { PlaceMap } from "@/components/listing/place-map";
import { CategoryIcon } from "@/components/place/category-icon";
import { FavoriteButton } from "@/components/place/favorite-button";
import { ListingSummary, isTrustedHost } from "@/components/place/listing-summary";
import { MeetHost } from "@/components/place/meet-host";
import { PhotoTour, photoGroups } from "@/components/place/photo-tour";
import { ShareButton } from "@/components/place/share-button";
import { Gallery } from "@/components/place/gallery";
import { formatMoney } from "@/lib/format";
import { findPageOr404 } from "@/server/http/page";
import { getCurrentUser } from "@/server/http/session";
import { getPlace } from "@/server/services/directory-service";
import { getHostSection } from "@/server/services/host-service";
import { favoriteSlugs } from "@/server/services/favorite-service";
import { listPublicReviews } from "@/server/services/review-service";
import { categoryName } from "@/config/appearance";
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
  const [t, locale, tKnow, tListing, tMap, reviews, saved, host] = await Promise.all([
    getTranslations("placePage"),
    getLocale(),
    getTranslations("thingsToKnow"),
    getTranslations("listing"),
    getTranslations("offeringPage"),
    listPublicReviews(place.id, 6),
    favoriteSlugs(user?.id),
    getHostSection(place),
  ]);
  const wholePlace = place.bookingUnit === "WHOLE_PLACE";
  // Booked whole: the rooms are shown as "where you'll sleep"; booked by room: each room can be booked.
  const roomsToShow = wholePlace ? place.showcaseRooms : place.rooms;
  const tourGroups = await photoGroups(place.photos, roomsToShow);
  // Booked room by room: the place's size is its bookable rooms added up.
  const sizes = place.rooms.reduce(
    (sum, room) => ({
      guests: sum.guests + room.capacity,
      bedrooms: sum.bedrooms + room.bedrooms,
      beds: sum.beds + room.beds,
      baths: sum.baths + room.bathrooms,
    }),
    { guests: 0, bedrooms: 0, beds: 0, baths: 0 },
  );
  const unit = place.rooms[0];
  const summary = [
    place.area,
    place.rating.count > 0 ? `★${place.rating.average.toFixed(2)}` : null,
    unit ? t("bedrooms", { count: wholePlace ? unit.bedrooms : place.rooms.length }) : null,
    unit && wholePlace ? t("beds", { count: unit.beds }) : null,
    unit && wholePlace ? t("baths", { count: unit.bathrooms }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const amenities = [
    ...new Set([...place.rooms, ...place.showcaseRooms].flatMap((room) => room.amenities)),
  ].filter(isAmenity);
  const photos = [
    ...place.photos,
    ...[...place.rooms, ...place.showcaseRooms].flatMap((room) => room.photos),
  ];
  const tags = keepKnown(TAGS, place.tags);
  const accessibility = keepKnown(ACCESSIBILITY, place.accessibility);
  const knowItems: KnowItem[] = [
    {
      icon: DoorOpen,
      title: tKnow("checkInOut"),
      body: tKnow("checkInOutBody", { in: place.checkInTime, out: place.checkOutTime }),
    },
    ...(place.minGuestAge
      ? [
          {
            icon: UsersRound,
            title: tKnow("requirements"),
            body: tKnow("stayRequirements", { age: place.minGuestAge }),
          },
        ]
      : []),
    ...(place.houseRules
      ? [
          {
            icon: ScrollText,
            title: tKnow("houseRules"),
            body: <p className="whitespace-pre-line">{place.houseRules}</p>,
          },
        ]
      : []),
    {
      icon: Accessibility,
      title: tKnow("accessibility"),
      body:
        accessibility.length > 0 ? (
          <KnowList items={accessibility.map((key) => tListing(`accessibility.${key}`))} />
        ) : (
          tKnow("noAccessibility")
        ),
    },
    ...(place.cancellationPolicy
      ? [
          {
            icon: CalendarX2,
            title: tKnow("cancellation"),
            body: <p className="whitespace-pre-line">{place.cancellationPolicy}</p>,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold">{place.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {place.area && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {place.area}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ShareButton title={place.name} summary={summary} path={`/p/${place.slug}`} />
          <FavoriteButton slug={place.slug} initial={saved.has(place.slug)} signedIn={Boolean(user)} />
        </div>
      </div>

      <Gallery
        photos={photos}
        seed={place.slug}
        name={place.name}
        allPhotos={
          photos.length > 0
            ? { href: `/p/${place.slug}/photos`, label: t("showAllPhotos"), groups: tourGroups }
            : undefined
        }
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="min-w-0">
          <ListingSummary
            heading={
              place.area
                ? t(wholePlace ? "wholeHomeIn" : "roomsIn", { area: place.area })
                : t(wholePlace ? "wholeHome" : "roomsHere")
            }
            facts={[
              t("guestsCount", { count: wholePlace && unit ? unit.capacity : sizes.guests }),
              t("bedrooms", { count: wholePlace && unit ? unit.bedrooms : sizes.bedrooms }),
              t("beds", { count: wholePlace && unit ? unit.beds : sizes.beds }),
              t("baths", { count: wholePlace && unit ? unit.bathrooms : sizes.baths }),
            ]}
            rating={place.rating}
            host={host}
            trusted={isTrustedHost(place.rating, host)}
          />
          {place.categories.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {place.categories.map(({ category }) => (
                <li
                  key={category.slug}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-line-strong"
                >
                  <CategoryIcon slug={category.slug} className="size-4 text-accent" />
                  {categoryName(category, locale)}
                </li>
              ))}
            </ul>
          )}
          {tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={tMap("tags")}>
              {tags.map((tag) => (
                <li key={tag} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold">
                  {tListing(`tags.${tag}`)}
                </li>
              ))}
            </ul>
          )}
          {place.description && (
            <p className="mt-6 text-[1.0625rem] leading-relaxed whitespace-pre-line">{place.description}</p>
          )}

          <dl className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
            <Fact icon={<Clock />} label={t("checkIn")} value={t("after", { time: place.checkInTime })} />
            <Fact icon={<Clock />} label={t("checkOut")} value={t("before", { time: place.checkOutTime })} />
            <Fact
              icon={<ShieldCheck />}
              label={t("deposit")}
              value={t("depositValue", { percent: place.depositPercent })}
            />
          </dl>

          <PhotoTour groups={tourGroups} href={`/p/${place.slug}/photos`} />

          <section className="mt-12 border-t border-line pt-12">
            <h2 className="text-[1.375rem] font-semibold">
              {wholePlace ? t("whereYoullSleep") : t("rooms")}
            </h2>
            {wholePlace && unit && (
              <p className="mt-2 text-muted">{t("wholePlaceIntro", { guests: unit.capacity })}</p>
            )}
            <ul className="mt-6 grid gap-4">
              {roomsToShow.map((room) => (
                <li key={room.id} className="rounded-xl p-5 ring-1 ring-line-strong">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold tracking-normal">{room.name}</h3>
                    {!wholePlace && (
                      <p>
                        <span className="font-bold">
                          {formatMoney(room.baseRateCents, place.currency, locale)}
                        </span>{" "}
                        <span className="text-muted">{t("perNight")}</span>
                      </p>
                    )}
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
            <section className="mt-12 border-t border-line pt-12">
              <h2 className="text-[1.375rem] font-semibold">{t("amenities")}</h2>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {amenities.map((name) => (
                  <Amenity key={name} name={name} label={t(`amenity.${name}`)} />
                ))}
              </ul>
            </section>
          )}

          <ReviewList reviews={reviews} rating={place.rating} />

          <PlaceMap
            title={tMap("whereYoullBe")}
            latitude={place.latitude}
            longitude={place.longitude}
            address={place.address ?? place.area}
            label={place.area}
            openLabel={tMap("openMaps")}
          />
          <ThingsToKnow title={tKnow("title")} items={knowItems} />
          <MeetHost host={host} rating={place.rating} placeName={place.name} />
        </div>

        <aside className="lg:sticky lg:top-28 lg:-m-1 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:p-1">
          {place.rooms.length > 0 ? (
            <BookingWidget
              slug={place.slug}
              currency={place.currency}
              rooms={place.rooms}
              initial={{ checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests }}
              instant={place.bookingMode === "INSTANT"}
              payOnline={place.paymentCollection === "ONLINE"}
            />
          ) : (
            <p className="rounded-xl p-6 text-muted ring-1 ring-line-strong">{t("noRooms")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-6 [&_svg]:text-ink">
      {icon}
      <div>
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}
