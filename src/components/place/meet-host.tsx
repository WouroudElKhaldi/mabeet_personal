import { BadgeCheck, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { HostSection } from "@/server/services/host-service";
import { isTrustedHost } from "./listing-summary";

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** How quickly the host usually answers, as a message key, or null for a host with no requests yet. */
export function responseTimeKey(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes <= 60) return "withinHour" as const;
  return minutes <= 24 * 60 ? ("withinDay" as const) : ("withinDays" as const);
}

/** "Meet your host": who runs the place, how long they've hosted, how they answer, and a way to message them. */
export async function MeetHost({
  host,
  rating,
  placeName,
  contactHref,
}: {
  host: HostSection;
  rating: { average: number; count: number };
  placeName: string;
  /** The listing's Contact host page, when it has one. */
  contactHref?: string;
}) {
  const [t, tLang, locale] = await Promise.all([
    getTranslations("meetHost"),
    getTranslations("listing.languages"),
    getLocale(),
  ]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const whatsapp = host.whatsapp?.replace(/\D/g, "");
  const languages = host.languages.map((code) => tLang(code as "ar" | "en" | "fr"));
  const responseKey = responseTimeKey(host.medianResponseMinutes);
  const responseTime = responseKey && t(responseKey);
  const trusted = isTrustedHost(rating, host);
  const messageable = host.acceptsMessages && contactHref !== undefined;

  return (
    <section className="mt-12 border-t border-line pt-12" aria-labelledby="meet-host">
      <h2 id="meet-host" className="text-[1.375rem] font-semibold">
        {t("title")}
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line">
          <div className="grid justify-items-center text-center">
            <span className="relative grid size-24 place-items-center rounded-full bg-accent font-display text-3xl font-semibold text-accent-ink">
              {initials(host.name) || "·"}
              {trusted && (
                <span className="absolute -end-1 bottom-1 grid size-8 place-items-center rounded-full bg-glow text-ink ring-4 ring-surface">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
              )}
            </span>
            <p className="mt-3 text-2xl font-semibold">{host.name}</p>
            {trusted && <p className="text-sm font-semibold text-muted">{t("trusted")}</p>}
          </div>
          <dl className="grid divide-y divide-line text-start">
            <div className="pb-3">
              <dd className="text-xl font-semibold tabular-nums">{number.format(rating.count)}</dd>
              <dt className="text-xs text-muted">{t("reviews", { count: rating.count })}</dt>
            </div>
            <div className="py-3">
              <dd className="text-xl font-semibold tabular-nums">
                {rating.count > 0 ? `${number.format(rating.average)}★` : "—"}
              </dd>
              <dt className="text-xs text-muted">{t("rating")}</dt>
            </div>
            <div className="pt-3">
              <dd className="text-xl font-semibold tabular-nums">{host.yearsHosting}</dd>
              <dt className="text-xs text-muted">{t("years", { count: host.yearsHosting })}</dt>
            </div>
          </dl>
        </div>

        <div className="grid content-start gap-5">
          {trusted && (
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <BadgeCheck className="size-5 text-accent" aria-hidden />
                {t("trustedTitle", { name: host.name })}
              </p>
              <p className="mt-1 text-sm text-muted">{t("trustedBody")}</p>
            </div>
          )}
          {languages.length > 0 && <p>{t("speaks", { languages: languages.join(", ") })}</p>}
          {host.bio && <p className="leading-relaxed whitespace-pre-line">{host.bio}</p>}
          <div>
            <h3 className="font-semibold">{t("details")}</h3>
            <ul className="mt-1 grid gap-1 text-sm">
              <li>
                {t("responseRate")}:{" "}
                <span className="font-semibold">
                  {host.responseRate === null ? t("new") : `${Math.round(host.responseRate * 100)}%`}
                </span>
              </li>
              {responseTime && <li>{responseTime}</li>}
            </ul>
          </div>
          {/* The host decides, for all their listings, whether guests see WhatsApp, the Contact host page, or both. */}
          {(whatsapp || messageable) && (
            <div className="flex flex-wrap items-center gap-3">
              {messageable && (
                <Link
                  href={contactHref}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 font-semibold text-paper transition-opacity hover:opacity-90"
                >
                  <Mail className="size-5" aria-hidden />
                  {t("contact")}
                </Link>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t("messageText", { place: placeName }))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("whatsapp")}
                  title={t("whatsapp")}
                  className={
                    messageable
                      ? "grid size-12 place-items-center rounded-xl bg-brand-whatsapp text-white transition-opacity hover:opacity-90"
                      : "inline-flex h-12 items-center gap-2 rounded-xl bg-brand-whatsapp px-6 font-semibold text-white transition-opacity hover:opacity-90"
                  }
                >
                  <MessageCircle className="size-5" aria-hidden />
                  {!messageable && t("whatsapp")}
                </a>
              )}
            </div>
          )}
          <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("protect")}
          </p>
        </div>
      </div>
    </section>
  );
}
