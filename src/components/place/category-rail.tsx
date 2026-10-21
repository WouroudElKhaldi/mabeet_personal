import { clsx } from "clsx";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { CategoryIcon } from "./category-icon";

interface Category {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export async function CategoryRail({ categories, active }: { categories: Category[]; active?: string }) {
  const locale = await getLocale();
  return (
    <nav aria-label="Categories" className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2">
      {categories.map((category) => {
        const selected = category.slug === active;
        return (
          <Link
            key={category.slug}
            href={selected ? "/search" : `/search?category=${category.slug}`}
            aria-current={selected ? "page" : undefined}
            className={clsx(
              "group flex shrink-0 flex-col items-center gap-2 rounded-lg px-4 pt-3 pb-2.5 text-xs font-semibold transition-colors",
              selected ? "bg-ink text-paper" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <CategoryIcon
              slug={category.slug}
              className="size-6 transition-transform duration-500 ease-(--ease-spring) group-hover:-translate-y-0.5 group-hover:scale-110"
            />
            {locale === "ar" ? category.nameAr : category.nameEn}
          </Link>
        );
      })}
    </nav>
  );
}
