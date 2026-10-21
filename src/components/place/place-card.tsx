import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Rating } from "@/components/ui/rating";
import { formatMoney } from "@/lib/format";
import type { PlaceCard as PlaceCardData } from "@/server/services/directory-service";
import { FavoriteButton } from "./favorite-button";
import { stagger } from "@/lib/motion";
import { PlaceArt } from "./place-art";

interface PlaceCardProps {
  place: PlaceCardData;
  saved: boolean;
  signedIn: boolean;
  /** Query string carried into the place page, e.g. the searched dates. */
  query?: string;
  index?: number;
}

export async function PlaceCard({ place, saved, signedIn, query = "", index = 0 }: PlaceCardProps) {
  const [t, locale] = await Promise.all([getTranslations("place"), getLocale()]);
  const stayTotal = place.offers[0]?.stayTotalCents ?? null;
  return (
    <article className="group rise-in relative" style={stagger(index)}>
      <Link href={`/p/${place.slug}${query}`} className="block focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-2">
          {place.photo ? (
            <Image
              src={place.photo.url}
              alt={place.photo.alt ?? place.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-[1200ms] ease-(--ease-out) group-hover:scale-[1.06]"
            />
          ) : (
            <PlaceArt
              seed={place.slug}
              className="size-full transition-transform duration-[1200ms] ease-(--ease-out) group-hover:scale-[1.06]"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          {place.categories[0] && (
            <span className="absolute start-3 top-3 rounded-full bg-paper/80 px-3 py-1 text-xs font-bold backdrop-blur-md">
              {locale === "ar" ? place.categories[0].nameAr : place.categories[0].nameEn}
            </span>
          )}
        </div>
        <div className="mt-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg leading-tight font-semibold">{place.name}</h3>
            <p className="truncate text-sm text-muted">{place.area}</p>
          </div>
          <Rating average={place.rating.average} count={place.rating.count} label={t("new")} />
        </div>
        <p className="mt-1.5 text-[0.9375rem]">
          {stayTotal !== null ? (
            <>
              <span className="font-bold">{formatMoney(stayTotal, place.currency, locale)}</span>{" "}
              <span className="text-muted">{t("total")}</span>
            </>
          ) : (
            place.nightlyFromCents !== null && (
              <>
                <span className="text-muted">{t("from")}</span>{" "}
                <span className="font-bold">
                  {formatMoney(place.nightlyFromCents, place.currency, locale)}
                </span>{" "}
                <span className="text-muted">{t("perNight")}</span>
              </>
            )
          )}
        </p>
      </Link>
      <div className="absolute end-3 top-3">
        <FavoriteButton slug={place.slug} initial={saved} signedIn={signedIn} />
      </div>
    </article>
  );
}
