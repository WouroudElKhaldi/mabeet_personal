import { CalendarCheck, Car, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ContactHostForm } from "@/components/place/contact-host-form";
import { responseTimeKey } from "@/components/place/meet-host";
import { PlaceArt } from "@/components/place/place-art";
import { ButtonLink } from "@/components/ui/button";
import { findPageOr404 } from "@/server/http/page";
import { getCurrentUser } from "@/server/http/session";
import { getPlace } from "@/server/services/directory-service";
import { getHostSection } from "@/server/services/host-service";
import { searchParams as searchSchema } from "@/server/validation/schemas";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [t, place] = await Promise.all([
    getTranslations("contactHost"),
    findPageOr404(getPlace((await params).slug)),
  ]);
  return { title: t("metaTitle", { place: place.name }), robots: { index: false } };
}

function Topic({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4 border-t border-line py-6">
      <span className="mt-0.5 text-muted [&>svg]:size-6" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-2 grid gap-1.5 text-sm leading-relaxed whitespace-pre-line text-muted">
          {children}
        </div>
      </div>
    </section>
  );
}

/** Airbnb-style "Contact the host": the answers guests usually look for, then a message the host gets by email. */
export default async function ContactHostPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const [t, tMeet, tKnow, place, user] = await Promise.all([
    getTranslations("contactHost"),
    getTranslations("meetHost"),
    getTranslations("thingsToKnow"),
    findPageOr404(getPlace(slug)),
    getCurrentUser(),
  ]);
  const host = await getHostSection(place);
  if (!host.acceptsMessages) redirect(`/p/${slug}`);

  const responseKey = responseTimeKey(host.medianResponseMinutes);
  const stay = {
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: query.checkIn ? query.guests : undefined,
  };
  const availabilityHref = query.checkIn
    ? `/p/${slug}?${new URLSearchParams({ checkIn: query.checkIn, checkOut: query.checkOut ?? "", guests: String(query.guests) })}`
    : `/p/${slug}`;
  const cover = place.photos[0];

  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-20 lg:px-10">
      <div className="min-w-0">
        <h1 className="rise-in text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold">
          {t("title", { name: host.name })}
        </h1>
        {responseKey && <p className="mt-2 text-muted">{tMeet(responseKey)}</p>}

        <h2 className="mt-10 text-xl font-semibold">{t("mostAsk")}</h2>
        <div className="mt-4">
          <Topic icon={<Car />} title={t("gettingThere")}>
            {place.area && <p>{t("location", { area: place.address ?? place.area })}</p>}
            <p>{tKnow("checkInOutBody", { in: place.checkInTime, out: place.checkOutTime })}</p>
          </Topic>
          <Topic icon={<CalendarCheck />} title={t("priceAvailability")}>
            <p>{t("deposit", { percent: place.depositPercent })}</p>
            {place.cancellationPolicy && <p>{place.cancellationPolicy}</p>}
          </Topic>
          {place.houseRules && (
            <Topic icon={<ScrollText />} title={tKnow("houseRules")}>
              <p>{place.houseRules}</p>
            </Topic>
          )}
        </div>

        <h2 className="mt-6 border-t border-line pt-10 text-xl font-semibold">{t("stillQuestions")}</h2>
        <p className="mt-2 mb-6 text-sm text-muted">{t("stillQuestionsBody", { name: host.name })}</p>
        <ContactHostForm
          slug={slug}
          hostName={host.name}
          guest={user ? { name: user.name, email: user.email } : null}
          stay={stay}
        />
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line">
          <div className="relative aspect-[4/3]">
            {cover ? (
              <Image
                src={cover.url}
                alt={cover.alt ?? place.name}
                fill
                sizes="360px"
                className="object-cover"
              />
            ) : (
              <PlaceArt seed={place.slug} className="size-full" />
            )}
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <p className="font-semibold">{place.name}</p>
              {place.area && <p className="text-sm text-muted">{place.area}</p>}
            </div>
            <ButtonLink href={availabilityHref} className="w-full">
              {t("checkAvailability")}
            </ButtonLink>
          </div>
        </div>
      </aside>
    </div>
  );
}
