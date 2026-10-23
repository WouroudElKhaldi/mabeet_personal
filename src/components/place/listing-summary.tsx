import { ShieldCheck, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { HostSection } from "@/server/services/host-service";

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * The block under a listing's photos, as on Airbnb: what it is and where, its size, its rating, then who hosts
 * it. Used by place and experience pages.
 */
export async function ListingSummary({
  heading,
  facts,
  rating,
  host,
  trusted,
}: {
  heading: string;
  /** e.g. ["4 guests", "2 bedrooms", "3 beds", "2 baths"]. */
  facts: string[];
  rating: { average: number; count: number };
  host: HostSection;
  trusted: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("listingSummary"), getLocale()]);
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <section aria-label={heading}>
      <h2 className="text-[1.375rem] leading-snug font-semibold">{heading}</h2>
      {facts.length > 0 && <p className="mt-1 text-[1.0625rem]">{facts.join(" · ")}</p>}
      <p className="mt-1 flex items-center gap-1.5 font-semibold">
        <Star className="size-4 fill-current" aria-hidden />
        {rating.count > 0 ? (
          <>
            <span aria-label={t("ratedOutOf", { rating: average.format(rating.average) })}>
              {average.format(rating.average)}
            </span>
            <span aria-hidden>·</span>
            <a href="#reviews" className="underline underline-offset-4">
              {t("reviews", { count: rating.count })}
            </a>
          </>
        ) : (
          <span>{t("new")}</span>
        )}
      </p>

      <div className="mt-6 flex items-center gap-4 border-y border-line py-5">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-ink">
          {initials(host.name) || "·"}
          {trusted && (
            <span className="absolute -end-1 -bottom-1 grid size-5 place-items-center rounded-full bg-glow text-ink ring-2 ring-paper">
              <ShieldCheck className="size-3" aria-hidden />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{t("hostedBy", { name: host.name })}</p>
          <p className="text-sm text-muted">
            {[trusted ? t("trusted") : null, t("yearsHosting", { count: host.yearsHosting })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The same "trusted host" rule everywhere: well rated, enough reviews, and answers almost every request. */
export const isTrustedHost = (rating: { average: number; count: number }, host: HostSection) =>
  rating.count >= 3 && rating.average >= 4.7 && (host.responseRate ?? 0) >= 0.9;
