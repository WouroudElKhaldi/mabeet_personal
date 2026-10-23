import {
  Accessibility,
  Activity,
  CalendarX2,
  CircleCheck,
  CircleX,
  Clock,
  Languages,
  MapPin,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { KnowList, type KnowItem, ThingsToKnow } from "@/components/listing/things-to-know";
import { PlaceMap } from "@/components/listing/place-map";
import { ReviewList } from "@/components/listing/review-list";
import { Duration } from "@/components/offering/duration";
import { SessionBookingCard } from "@/components/offering/session-booking-card";
import { CategoryIcon } from "@/components/place/category-icon";
import { Gallery } from "@/components/place/gallery";
import { ListingSummary, isTrustedHost } from "@/components/place/listing-summary";
import { MeetHost } from "@/components/place/meet-host";
import { ShareButton } from "@/components/place/share-button";
import { ACCESSIBILITY, keepKnown, LANGUAGES, TAGS } from "@/config/listing";
import { findPageOr404 } from "@/server/http/page";
import { getCurrentUser } from "@/server/http/session";
import { getOffering } from "@/server/services/directory-service";
import { categoryName } from "@/config/appearance";
import { listOfferingReviews } from "@/server/services/review-service";
import { getHostSection } from "@/server/services/host-service";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const offering = await findPageOr404(getOffering((await params).slug));
  return { title: offering.title, description: offering.description?.slice(0, 160) };
}

/** An experience or a service: what it is, what to know before booking, where you meet, and its dates. */
export default async function OfferingPage({ params }: PageProps) {
  const { slug } = await params;
  const [offering, user, t, tKnow, tListing, locale] = await Promise.all([
    findPageOr404(getOffering(slug)),
    getCurrentUser(),
    getTranslations("offeringPage"),
    getTranslations("thingsToKnow"),
    getTranslations("listing"),
    getLocale(),
  ]);

  const [reviews, host, tDuration] = await Promise.all([
    listOfferingReviews(offering.id, 100),
    getHostSection(offering.business),
    getTranslations("listingSummary"),
  ]);
  const accessibility = keepKnown(ACCESSIBILITY, offering.accessibility);
  const languages = keepKnown(LANGUAGES, offering.languages);
  const tags = keepKnown(TAGS, offering.tags);
  const activity = offering.activityLevel ? tListing(`activity.${offering.activityLevel}`) : null;
  const skill = offering.skillLevel ? tListing(`skill.${offering.skillLevel}`) : null;
  const cancellation =
    offering.cancellationHours >= 24 && offering.cancellationHours % 24 === 0
      ? tKnow("cancellationDays", { days: offering.cancellationHours / 24 })
      : tKnow("cancellationHours", { hours: offering.cancellationHours });

  const items: KnowItem[] = [
    {
      icon: UsersRound,
      title: tKnow("requirements"),
      body: offering.minAge
        ? tKnow("requirementsAge", { age: offering.minAge, max: offering.maxGuests })
        : tKnow("requirementsMax", { max: offering.maxGuests }),
    },
    ...(activity
      ? [
          {
            icon: Activity,
            title: tKnow("activity"),
            body: skill ? tKnow("activityBody", { activity, skill }) : tKnow("activityOnly", { activity }),
          },
        ]
      : []),
    ...(offering.included.length > 0
      ? [{ icon: CircleCheck, title: tKnow("included"), body: <KnowList items={offering.included} /> }]
      : []),
    ...(offering.notIncluded.length > 0
      ? [{ icon: CircleX, title: tKnow("notIncluded"), body: <KnowList items={offering.notIncluded} /> }]
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
    { icon: CalendarX2, title: tKnow("cancellation"), body: cancellation },
    ...(languages.length > 0
      ? [
          {
            icon: Languages,
            title: tKnow("languages"),
            body: languages.map((code) => tListing(`languages.${code}`)).join(" · "),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[1.75rem] leading-tight font-semibold">{offering.title}</h1>
        <ShareButton
          title={offering.title}
          summary={[
            offering.area,
            offering.rating.count > 0 ? `★${offering.rating.average.toFixed(2)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          path={`/o/${offering.slug}`}
        />
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9375rem]">
        {offering.category && (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <CategoryIcon slug={offering.category.slug} className="size-4" />
            {categoryName(offering.category, locale)}
          </span>
        )}
        {offering.area && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {offering.area}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden />
          <Duration minutes={offering.durationMinutes} />
        </span>
      </p>

      <div className="mt-6">
        <Gallery
          photos={offering.photos}
          seed={offering.slug}
          name={offering.title}
          allPhotos={
            offering.photos.length > 1
              ? {
                  href: `/o/${offering.slug}/photos`,
                  label: t("showAllPhotos"),
                  groups: [{ key: "all", label: offering.title, photos: offering.photos }],
                }
              : undefined
          }
        />
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="min-w-0">
          <ListingSummary
            heading={
              offering.area
                ? t(offering.kind === "SERVICE" ? "serviceIn" : "experienceIn", { area: offering.area })
                : t(offering.kind === "SERVICE" ? "service" : "experience")
            }
            facts={[
              tDuration("hours", { count: Math.round((offering.durationMinutes / 60) * 10) / 10 }),
              t("upTo", { count: offering.maxGuests }),
              ...(languages.length > 0
                ? [languages.map((code) => tListing(`languages.${code}`)).join(", ")]
                : []),
            ]}
            rating={offering.rating}
            host={host}
            trusted={isTrustedHost(offering.rating, host)}
          />
          {offering.description && (
            <p className="mt-8 text-[1.0625rem] leading-relaxed whitespace-pre-line">
              {offering.description}
            </p>
          )}
          {tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("tags")}>
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-line-strong"
                >
                  {tListing(`tags.${tag}`)}
                </li>
              ))}
            </ul>
          )}

          <ThingsToKnow title={tKnow("title")} items={items} />
          <ReviewList reviews={reviews} rating={offering.rating} emptyLabel={t("noReviews")} />
          <MeetHost host={host} rating={offering.rating} placeName={offering.title} />
          <PlaceMap
            title={t("whereYouMeet")}
            latitude={offering.latitude}
            longitude={offering.longitude}
            address={offering.meetingPoint ?? offering.area}
            label={offering.meetingPoint}
            openLabel={t("openMaps")}
          />
        </div>

        <aside className="lg:sticky lg:top-28 lg:-m-1 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:p-1">
          <SessionBookingCard
            slug={offering.slug}
            currency={offering.business.currency}
            priceCents={offering.priceCents}
            priceUnit={offering.priceUnit}
            maxGuests={offering.maxGuests}
            depositPercent={offering.business.depositPercent}
            timezone={offering.business.timezone}
            sessions={offering.sessions.map((session) => ({
              id: session.id,
              startsAt: session.startsAt.toISOString(),
              seatsLeft: session.seatsLeft,
            }))}
            defaults={{ name: user?.name, email: user?.email }}
            instant={offering.business.bookingMode === "INSTANT"}
            payOnline={offering.business.paymentCollection === "ONLINE"}
          />
        </aside>
      </div>
    </div>
  );
}
