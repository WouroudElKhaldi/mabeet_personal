import { ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OfferingCard } from "@/components/offering/offering-card";
import { PlaceCard } from "@/components/place/place-card";
import { SearchBar } from "@/components/site/search-bar";
import { ButtonLink } from "@/components/ui/button";
import type { ListingTab } from "@/config/listing";
import { optionalDateRange } from "@/lib/dates";
import { searchHref, type SearchState } from "@/lib/search-url";
import { getCurrentUser } from "@/server/http/session";
import {
  listCategories,
  type OfferingCard as OfferingCardData,
  type PlaceCard as PlaceCardData,
  searchOfferings,
  searchPlaces,
} from "@/server/services/directory-service";
import { favoriteSlugs } from "@/server/services/favorite-service";
import { CategoryBar } from "./category-bar";
import { ListingTabs } from "./listing-tabs";
import { ResultsGrid } from "./results-grid";

const SECTION_SIZE = 6;
const FULL_SIZE = 48;

/**
 * Tabs, search, categories, then results. "All" shows a short row per type; one type shows its full grid.
 * Used by the home page and the search page, so both always behave the same.
 */
export async function Browse({
  state,
  basePath,
  showSearch = true,
}: {
  state: SearchState & { type: ListingTab };
  basePath: string;
  /** The home page puts the search bar in its hero instead. */
  showSearch?: boolean;
}) {
  const user = await getCurrentUser();
  const [t, categories, saved] = await Promise.all([
    getTranslations("searchPage"),
    listCategories(),
    favoriteSlugs(user?.id),
  ]);
  const range = optionalDateRange(state.checkIn, state.checkOut);
  const kindOf = new Map(categories.map((category) => [category.slug, category.kind]));
  const picked = (kind: string) => state.category?.filter((slug) => kindOf.get(slug) === kind);
  const cents = (value?: number) => (value === undefined ? undefined : value * 100);
  const limit = state.type === "all" ? SECTION_SIZE : FULL_SIZE;
  const wants = (tab: ListingTab) => state.type === "all" || state.type === tab;

  const shared = {
    text: state.q,
    area: state.area,
    tags: state.tags,
    accessibility: state.access,
    guests: state.guests,
    minPriceCents: cents(state.minPrice),
    maxPriceCents: cents(state.maxPrice),
  };
  const [homes, experiences, services] = await Promise.all([
    wants("homes")
      ? searchPlaces({
          guests: state.guests ?? 1,
          area: state.area,
          text: state.q,
          categories: picked("HOME"),
          amenities: state.amenities,
          tags: state.tags,
          accessibility: state.access,
          minRateCents: shared.minPriceCents,
          maxRateCents: shared.maxPriceCents,
          range,
          limit,
        })
      : [],
    wants("experiences")
      ? searchOfferings({ ...shared, kind: "EXPERIENCE", categories: picked("EXPERIENCE"), range, limit })
      : [],
    wants("services")
      ? searchOfferings({ ...shared, kind: "SERVICE", categories: picked("SERVICE"), range, limit })
      : [],
  ]);
  const placeQuery = range
    ? `?checkIn=${state.checkIn}&checkOut=${state.checkOut}&guests=${state.guests ?? 1}`
    : "";
  const total = homes.length + experiences.length + services.length;

  const homeGrid = (places: PlaceCardData[]) =>
    places.map((place, index) => (
      <PlaceCard
        key={place.slug}
        place={place}
        saved={saved.has(place.slug)}
        signedIn={Boolean(user)}
        query={placeQuery}
        index={index}
      />
    ));
  const offeringGrid = (offerings: OfferingCardData[]) =>
    offerings.map((offering, index) => (
      <OfferingCard key={offering.slug} offering={offering} index={index} />
    ));

  const sections = [
    { tab: "homes" as const, cards: homeGrid(homes), count: homes.length },
    { tab: "experiences" as const, cards: offeringGrid(experiences), count: experiences.length },
    { tab: "services" as const, cards: offeringGrid(services), count: services.length },
  ].filter((section) => wants(section.tab) && section.count > 0);

  const keep = { q: state.q, area: state.area, checkIn: state.checkIn, checkOut: state.checkOut };

  return (
    <div className="mx-auto max-w-360 px-4 sm:px-6 lg:px-10">
      <div className="grid min-w-0 grid-cols-1 justify-items-center gap-6 pt-6">
        <ListingTabs current={state.type} basePath={basePath} keep={keep} />
        {showSearch && (
          <SearchBar
            defaults={{
              area: state.area,
              checkIn: state.checkIn,
              checkOut: state.checkOut,
              guests: state.guests,
            }}
            type={state.type}
          />
        )}
      </div>
      <div className="mt-6 border-b border-line">
        <CategoryBar state={state} categories={categories} />
      </div>

      {total === 0 ? (
        <div className="mt-10 grid place-items-center gap-4 rounded-2xl border border-line px-6 py-20 text-center">
          <SearchX className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
          <p className="text-xl font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-md text-muted">{t("emptyBody")}</p>
          <ButtonLink href="/assistant" variant="secondary">
            {t("askConcierge")}
          </ButtonLink>
        </div>
      ) : state.type === "all" ? (
        sections.map((section) => (
          <section key={section.tab} className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-[1.375rem] font-semibold tracking-tight">{t(`sections.${section.tab}`)}</h2>
              <Link
                href={searchHref({ ...state, type: section.tab })}
                className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
              >
                {t("seeAll")}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
            <ResultsGrid>{section.cards}</ResultsGrid>
          </section>
        ))
      ) : (
        <section className="mt-8">
          <h1 className="mb-5 text-base font-semibold tracking-normal">{t("results", { count: total })}</h1>
          <ResultsGrid>{sections[0]?.cards}</ResultsGrid>
        </section>
      )}
    </div>
  );
}
