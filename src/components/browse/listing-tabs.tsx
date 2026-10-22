import { clsx } from "clsx";
import { ConciergeBell, Compass, House, LayoutGrid, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LISTING_TABS, type ListingTab } from "@/config/listing";

const ICONS: Record<ListingTab, LucideIcon> = {
  all: LayoutGrid,
  homes: House,
  experiences: Compass,
  services: ConciergeBell,
};

/** All · Homes · Experiences · Services. Switching type keeps the search words, dates and guests. */
export async function ListingTabs({
  current,
  basePath,
  keep = {},
}: {
  current: ListingTab;
  basePath: string;
  keep?: Record<string, string | undefined>;
}) {
  const t = await getTranslations("listing.tabs");
  const hrefFor = (tab: ListingTab) => {
    const params = new URLSearchParams(
      Object.entries(keep).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    if (tab !== "all") params.set("type", tab);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <nav
      aria-label={t("all")}
      className="scrollbar-none flex max-w-full gap-5 overflow-x-auto px-1 sm:justify-center sm:gap-10"
    >
      {LISTING_TABS.map((tab) => {
        const Icon = ICONS[tab];
        const active = tab === current;
        return (
          <Link
            key={tab}
            href={hrefFor(tab)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-sm font-semibold transition-colors sm:gap-2 sm:text-[0.9375rem]",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon
              className={clsx("size-5 transition-transform group-hover:scale-110", active && "text-accent")}
              aria-hidden
              strokeWidth={1.8}
            />
            {t(tab)}
          </Link>
        );
      })}
    </nav>
  );
}
