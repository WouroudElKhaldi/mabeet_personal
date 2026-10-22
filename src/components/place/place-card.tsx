import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Rating } from "@/components/ui/rating";
import { formatMoney } from "@/lib/format";
import { stagger } from "@/lib/motion";
import type { PlaceCard as PlaceCardData } from "@/server/services/directory-service";
import { FavoriteButton } from "./favorite-button";
import { PlaceArt } from "./place-art";

interface PlaceCardProps {
  place: PlaceCardData;
  saved: boolean;
  signedIn: boolean;
  /** Query string carried into the place page, e.g. the searched dates. */
  query?: string;
  index?: number;
}

/** A square photo, then three short lines: name and rating, area, price. */
export async function PlaceCard({ place, saved, signedIn, query = "", index = 0 }: PlaceCardProps) {
  const [t, locale] = await Promise.all([getTranslations("place"), getLocale()]);
  const stayTotal = place.offers[0]?.stayTotalCents ?? null;
  const category = place.categories[0];
  return (
    <article className="group rise-in relative" style={stagger(index)}>
      <Link href={`/p/${place.slug}${query}`} className="block rounded-xl">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
          {place.photo ? (
            <Image
              src={place.photo.url}
              alt={place.photo.alt ?? place.name}
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 ease-(--ease-out) group-hover:scale-[1.04]"
            />
          ) : (
            <PlaceArt seed={place.slug} className="size-full" />
          )}
          {category && (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
              {locale === "ar" ? category.nameAr : category.nameEn}
            </span>
          )}
        </div>
        <div className="mt-2.5 grid text-sm leading-snug">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold tracking-normal">{place.name}</h3>
            <Rating average={place.rating.average} count={place.rating.count} label={t("new")} compact />
          </div>
          <p className="truncate text-muted">{place.area}</p>
          <p className="mt-0.5">
            {stayTotal !== null ? (
              <>
                <span className="font-semibold underline underline-offset-2">
                  {formatMoney(stayTotal, place.currency, locale)}
                </span>{" "}
                <span className="text-muted">{t("total")}</span>
              </>
            ) : (
              place.nightlyFromCents !== null && (
                <>
                  <span className="font-semibold">
                    {formatMoney(place.nightlyFromCents, place.currency, locale)}
                  </span>{" "}
                  <span className="text-muted">{t("perNight")}</span>
                </>
              )
            )}
          </p>
        </div>
      </Link>
      <div className="absolute end-1.5 top-1.5">
        <FavoriteButton slug={place.slug} initial={saved} signedIn={signedIn} overlay />
      </div>
    </article>
  );
}
