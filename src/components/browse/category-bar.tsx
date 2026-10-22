import { clsx } from "clsx";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/place/category-icon";
import { TAB_KIND } from "@/config/listing";
import { searchHref, type SearchState } from "@/lib/search-url";
import { FiltersDialog } from "./filters-dialog";
import { categoryName } from "@/config/appearance";
import { ScrollRail } from "./scroll-rail";

interface Category {
  slug: string;
  kind: string;
  nameEn: string;
  nameAr: string;
  icon: string;
}

const TAB_OF_KIND: Record<string, string> = { HOME: "homes", EXPERIENCE: "experiences", SERVICE: "services" };

/** The current type's categories as icon tabs, with the Filters button at the end. */
export async function CategoryBar({ state, categories }: { state: SearchState; categories: Category[] }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("filters")]);
  const kind = state.type && state.type !== "all" ? TAB_KIND[state.type as keyof typeof TAB_KIND] : undefined;
  const shown = kind ? categories.filter((category) => category.kind === kind) : categories;
  const forFilters = kind ? shown : categories;

  return (
    <div className="flex items-center gap-6">
      <ScrollRail label={t("categories")} labels={{ previous: t("previous"), next: t("next") }}>
        {shown.map((category) => {
          const selected = state.category?.includes(category.slug) ?? false;
          return (
            <Link
              key={category.slug}
              href={searchHref({
                ...state,
                type: TAB_OF_KIND[category.kind] ?? state.type,
                category: selected ? [] : [category.slug],
              })}
              aria-current={selected ? "page" : undefined}
              className={clsx(
                "flex shrink-0 flex-col items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                selected
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              <CategoryIcon slug={category.slug} icon={category.icon} className="size-6" />
              {categoryName(category, locale)}
            </Link>
          );
        })}
      </ScrollRail>
      <FiltersDialog state={state} categories={forFilters} />
    </div>
  );
}
