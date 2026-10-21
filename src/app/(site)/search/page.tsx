import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CategoryRail } from "@/components/place/category-rail";
import { PlaceGrid } from "@/components/place/place-grid";
import { SearchBar } from "@/components/site/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { optionalDateRange } from "@/lib/dates";
import { getCurrentUser } from "@/server/http/session";
import { listCategories, searchPlaces } from "@/server/services/directory-service";
import { favoriteSlugs } from "@/server/services/favorite-service";
import { searchParams as searchSchema } from "@/server/validation/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("searchPage");
  return { title: t("title") };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const query = searchSchema.parse(await searchParams);
  const range = optionalDateRange(query.checkIn, query.checkOut);
  const user = await getCurrentUser();
  const [t, categories, places, saved] = await Promise.all([
    getTranslations("searchPage"),
    listCategories(),
    searchPlaces({
      guests: query.guests,
      area: query.area,
      text: query.q,
      categories: query.category ? [query.category] : undefined,
      maxRateCents: query.maxPrice ? query.maxPrice * 100 : undefined,
      range,
      limit: 48,
    }),
    favoriteSlugs(user?.id),
  ]);

  const carried = range ? `?checkIn=${query.checkIn}&checkOut=${query.checkOut}&guests=${query.guests}` : "";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <SearchBar
        compact
        defaults={{
          area: query.area,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          guests: query.guests,
        }}
      />
      <div className="mt-8">
        <CategoryRail categories={categories} active={query.category} />
      </div>
      <h1 className="mt-8 mb-8 text-3xl font-medium sm:text-4xl">
        {range ? t("freeHeading", { count: places.length }) : t("heading", { count: places.length })}
      </h1>
      {places.length > 0 ? (
        <PlaceGrid places={places} savedSlugs={saved} signedIn={Boolean(user)} query={carried} />
      ) : (
        <div className="grid place-items-center gap-4 rounded-xl bg-surface px-6 py-20 text-center ring-1 ring-line">
          <SearchX className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
          <p className="font-display text-2xl">{t("emptyTitle")}</p>
          <p className="max-w-md text-muted">{t("emptyBody")}</p>
          <ButtonLink href="/assistant" variant="secondary">
            {t("askConcierge")}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
