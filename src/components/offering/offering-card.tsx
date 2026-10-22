import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/place/place-art";
import { Rating } from "@/components/ui/rating";
import { formatMoney } from "@/lib/format";
import { stagger } from "@/lib/motion";
import { formatSessionTime } from "@/lib/zoned-time";
import type { OfferingCard as OfferingCardData } from "@/server/services/directory-service";
import { Duration } from "./duration";

/** Same shape as a place card: square photo, title, category and duration, price, next date. */
export async function OfferingCard({ offering, index = 0 }: { offering: OfferingCardData; index?: number }) {
  const [t, locale] = await Promise.all([getTranslations("offering"), getLocale()]);
  const category = offering.category;
  return (
    <article className="group rise-in" style={stagger(index)}>
      <Link href={`/o/${offering.slug}`} className="block rounded-xl">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
          {offering.photo ? (
            <Image
              src={offering.photo.url}
              alt={offering.photo.alt ?? offering.title}
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 ease-(--ease-out) group-hover:scale-[1.04]"
            />
          ) : (
            <PlaceArt seed={offering.slug} className="size-full" />
          )}
          {category && (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
              {locale === "ar" ? category.nameAr : category.nameEn}
            </span>
          )}
        </div>
        <div className="mt-2.5 grid text-sm leading-snug">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-semibold tracking-normal">{offering.title}</h3>
            <Rating
              average={offering.rating.average}
              count={offering.rating.count}
              label={t("new")}
              compact
            />
          </div>
          <p className="truncate text-muted">
            {offering.area} · <Duration minutes={offering.durationMinutes} />
          </p>
          {offering.nextStartsAt && (
            <p className="truncate text-muted">
              {t("next", { when: formatSessionTime(offering.nextStartsAt, locale, offering.timezone) })}
            </p>
          )}
          <p className="mt-0.5">
            <span className="text-muted">{t("from")}</span>{" "}
            <span className="font-semibold">
              {formatMoney(offering.priceCents, offering.currency, locale)}
            </span>{" "}
            <span className="text-muted">
              {offering.priceUnit === "PER_PERSON" ? t("perPerson") : t("perGroup")}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}
