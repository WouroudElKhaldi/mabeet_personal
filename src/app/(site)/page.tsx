import {
  ArrowRight,
  BadgePercent,
  CalendarCheck,
  HandCoins,
  MessageCircleHeart,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CategoryRail } from "@/components/place/category-rail";
import { PlaceGrid } from "@/components/place/place-grid";
import { HeroLandscape } from "@/components/site/hero-landscape";
import { SearchBar } from "@/components/site/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/server/http/session";
import { listCategories, searchPlaces } from "@/server/services/directory-service";
import { stagger } from "@/lib/motion";
import { favoriteSlugs } from "@/server/services/favorite-service";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [t, categories, places, saved] = await Promise.all([
    getTranslations("home"),
    listCategories(),
    searchPlaces({ guests: 1, limit: 8 }),
    favoriteSlugs(user?.id),
  ]);

  const steps = [
    { icon: BadgePercent, title: t("steps.noFees.title"), body: t("steps.noFees.body") },
    { icon: CalendarCheck, title: t("steps.held.title"), body: t("steps.held.body") },
    { icon: HandCoins, title: t("steps.deposit.title"), body: t("steps.deposit.body") },
  ];

  return (
    <>
      <section className="relative -mt-18 overflow-hidden pt-18">
        <HeroLandscape />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-40 sm:px-6 sm:pt-24 lg:px-8 lg:pb-52">
          <p className="rise-in inline-flex items-center gap-2 rounded-full bg-surface/70 px-3.5 py-1.5 text-xs font-bold tracking-[0.12em] text-muted uppercase ring-1 ring-line backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            {t("eyebrow")}
          </p>
          <h1
            className="rise-in mt-6 max-w-4xl text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.95] font-medium"
            style={stagger(1)}
          >
            {t.rich("title", { em: (chunk) => <em className="font-normal text-accent italic">{chunk}</em> })}
          </h1>
          <p className="rise-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={stagger(2)}>
            {t("subtitle")}
          </p>
          <div className="rise-in mt-10" style={stagger(3)}>
            <SearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CategoryRail categories={categories} />
        <div className="mt-10 mb-8 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-medium sm:text-4xl">{t("featured")}</h2>
          <ButtonLink href="/search" variant="ghost" size="sm">
            {t("seeAll")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </ButtonLink>
        </div>
        {places.length > 0 ? (
          <PlaceGrid places={places} savedSlugs={saved} signedIn={Boolean(user)} />
        ) : (
          <p className="rounded-lg bg-surface p-10 text-center text-muted ring-1 ring-line">{t("empty")}</p>
        )}
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <h2 className="text-4xl leading-tight font-medium sm:text-5xl">
              {t.rich("directTitle", { em: (chunk) => <em className="text-accent italic">{chunk}</em> })}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{t("directBody")}</p>
          </div>
          <ol className="grid gap-4">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className="group flex gap-5 rounded-lg bg-surface p-6 ring-1 ring-line transition-[transform,box-shadow] duration-500 ease-(--ease-out) hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="font-display text-4xl leading-none font-light text-faint tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-semibold">
                    <Icon className="size-5 text-accent" aria-hidden />
                    {title}
                  </h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-xl bg-ink px-6 py-14 text-paper sm:px-14 sm:py-20">
          <div className="absolute -end-24 -top-24 size-80 rounded-full bg-accent opacity-40 blur-3xl motion-safe:animate-[drift_14s_ease-in-out_infinite]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase opacity-70">
                <Sparkles className="size-4" aria-hidden />
                {t("concierge.eyebrow")}
              </p>
              <h2 className="mt-4 text-4xl leading-tight font-medium sm:text-5xl">{t("concierge.title")}</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed opacity-75">{t("concierge.body")}</p>
              <ButtonLink href="/assistant" className="mt-8" size="lg">
                <MessageCircleHeart className="size-5" aria-hidden />
                {t("concierge.cta")}
              </ButtonLink>
            </div>
            <div className="grid gap-3 text-[0.9375rem]">
              <p className="ms-auto max-w-sm rounded-2xl rounded-ee-sm bg-paper/10 px-4 py-3 backdrop-blur">
                {t("concierge.sampleQuestion")}
              </p>
              <p className="max-w-sm rounded-2xl rounded-es-sm bg-accent px-4 py-3 text-accent-ink">
                {t("concierge.sampleAnswer")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
