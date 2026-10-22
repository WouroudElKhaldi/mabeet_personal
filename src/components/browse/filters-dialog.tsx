"use client";

import { clsx } from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { AMENITIES } from "@/config/amenities";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { inputClass } from "@/components/ui/field";
import { categoryName } from "@/config/appearance";
import { activeFilterCount, searchHref, type SearchState } from "@/lib/search-url";

interface FilterCategory {
  slug: string;
  kind: string;
  nameEn: string;
  nameAr: string;
}

/** The Filters button and its dialog: price, categories, amenities, tags and accessibility. */
export function FiltersDialog({ state, categories }: { state: SearchState; categories: FilterCategory[] }) {
  const t = useTranslations("filters");
  const tListing = useTranslations("listing");
  const tAmenity = useTranslations("placePage.amenity");
  const locale = useLocale();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SearchState>(state);
  const count = activeFilterCount(state);
  const showAmenities = !state.type || state.type === "all" || state.type === "homes";

  const open = () => {
    setDraft(state);
    dialog.current?.showModal();
  };
  const toggle = (key: "category" | "tags" | "amenities" | "access", value: string) =>
    setDraft((current) => {
      const list = current[key] ?? [];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  const price = (key: "minPrice" | "maxPrice", raw: string) =>
    setDraft((current) => ({
      ...current,
      [key]: raw === "" ? undefined : Math.max(1, Math.round(Number(raw))),
    }));
  const apply = (next: SearchState) => {
    dialog.current?.close();
    router.push(searchHref(next));
  };
  const cleared: SearchState = {
    ...state,
    category: [],
    tags: [],
    amenities: [],
    access: [],
    minPrice: undefined,
    maxPrice: undefined,
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="relative inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-line-strong transition-shadow hover:ring-ink"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {t("button")}
        {count > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-ink text-[0.6875rem] font-bold text-paper">
            {count}
          </span>
        )}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="filters-title"
        onClick={(event) => event.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[90dvh] w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-lift backdrop:bg-black/50"
      >
        <div className="flex max-h-[90dvh] flex-col">
          <header className="relative flex h-16 shrink-0 items-center justify-center border-b border-line">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t("close")}
              className="absolute start-4 grid size-9 place-items-center rounded-full hover:bg-surface-2"
            >
              <X className="size-4" aria-hidden />
            </button>
            <h2 id="filters-title" className="text-base font-semibold tracking-normal">
              {t("title")}
            </h2>
          </header>

          <div className="grid gap-8 overflow-y-auto px-6 py-6">
            <Section title={t("price")} hint={t("priceHint")}>
              <div className="grid grid-cols-2 gap-3">
                {(["minPrice", "maxPrice"] as const).map((key) => (
                  <label key={key} className="grid gap-1 text-xs font-semibold text-muted">
                    {t(key === "minPrice" ? "min" : "max")}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={draft[key] ?? ""}
                      onChange={(event) => price(key, event.target.value)}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </Section>

            <Section title={t("categories")}>
              <Chips>
                {categories.map((category) => (
                  <Chip
                    key={category.slug}
                    on={draft.category?.includes(category.slug) ?? false}
                    onToggle={() => toggle("category", category.slug)}
                  >
                    {categoryName(category, locale)}
                  </Chip>
                ))}
              </Chips>
            </Section>

            {showAmenities && (
              <Section title={t("amenities")}>
                <Chips>
                  {AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity}
                      on={draft.amenities?.includes(amenity) ?? false}
                      onToggle={() => toggle("amenities", amenity)}
                    >
                      {tAmenity(amenity)}
                    </Chip>
                  ))}
                </Chips>
              </Section>
            )}

            <Section title={t("tags")}>
              <Chips>
                {TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    on={draft.tags?.includes(tag) ?? false}
                    onToggle={() => toggle("tags", tag)}
                  >
                    {tListing(`tags.${tag}`)}
                  </Chip>
                ))}
              </Chips>
            </Section>

            <Section title={t("accessibility")}>
              <Chips>
                {ACCESSIBILITY.map((feature) => (
                  <Chip
                    key={feature}
                    on={draft.access?.includes(feature) ?? false}
                    onToggle={() => toggle("access", feature)}
                  >
                    {tListing(`accessibility.${feature}`)}
                  </Chip>
                ))}
              </Chips>
            </Section>
          </div>

          <footer className="flex h-20 shrink-0 items-center justify-between border-t border-line px-6">
            <button
              type="button"
              onClick={() => apply(cleared)}
              className="text-sm font-semibold underline underline-offset-4"
            >
              {t("clear")}
            </button>
            <button
              type="button"
              onClick={() => apply(draft)}
              className="h-12 rounded-lg bg-ink px-6 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
            >
              {t("show")}
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-line pb-8 last:border-0 last:pb-0">
      <div>
        <h3 className="text-lg font-semibold tracking-normal">{title}</h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const Chips = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap gap-2">{children}</div>
);

function Chip({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={clsx(
        "rounded-full px-4 py-2 text-sm transition-colors",
        on ? "bg-ink font-semibold text-paper" : "ring-1 ring-line-strong hover:ring-ink",
      )}
    >
      {children}
    </button>
  );
}
