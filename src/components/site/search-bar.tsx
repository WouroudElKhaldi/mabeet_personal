"use client";

import { clsx } from "clsx";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DateRangePicker, type StayRange } from "@/components/ui/date-range-picker";
import { GuestCounter } from "@/components/ui/guest-counter";
import { parseIsoDate } from "@/lib/dates";
import { formatStayDates } from "@/lib/format";

type Panel = "where" | "when" | "who" | null;

export interface SearchDefaults {
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

/** Stored area values stay in English (they match listings); the label is translated. */
const POPULAR_AREAS = [
  "Batroun",
  "Byblos",
  "Chouf",
  "Ehden",
  "Tannourine",
  "Jezzine",
  "Douma",
  "Tyre",
] as const;

/** The pill search: where, when, who and a round search button. Every segment works from the keyboard. */
export function SearchBar({ defaults = {}, type = "all" }: { defaults?: SearchDefaults; type?: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const root = useRef<HTMLFormElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [area, setArea] = useState(defaults.area ?? "");
  const [range, setRange] = useState<StayRange>({
    checkIn: defaults.checkIn ?? null,
    checkOut: defaults.checkOut ?? null,
  });
  const [guests, setGuests] = useState(defaults.guests ?? 2);
  // Phones show one compact pill until the guest taps it, like the big booking apps.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node)
      ) {
        setPanel(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams({ guests: String(guests) });
    if (type !== "all") params.set("type", type);
    if (area) params.set("area", area);
    if (range.checkIn && range.checkOut) {
      params.set("checkIn", range.checkIn);
      params.set("checkOut", range.checkOut);
    }
    setPanel(null);
    router.push(`/search?${params}`);
  };

  const pickRange = (next: StayRange) => {
    setRange(next);
    if (next.checkOut) setPanel("who");
  };

  const dateLabel =
    range.checkIn && range.checkOut
      ? formatStayDates(parseIsoDate(range.checkIn), parseIsoDate(range.checkOut), locale)
      : t("anyDates");

  const summary = [
    area || null,
    range.checkIn && range.checkOut ? dateLabel : t("anyDates"),
    t("guests", { count: guests }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 rounded-full bg-surface px-5 py-3 text-start shadow-lift ring-1 ring-line-strong sm:hidden"
        >
          <Search className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="grid min-w-0">
            <span className="text-sm font-semibold">{area || t("whereTo")}</span>
            <span className="truncate text-xs text-muted">{summary}</span>
          </span>
        </button>
      )}
      <form
        ref={root}
        onSubmit={submit}
        role="search"
        className={clsx(
          "relative w-full max-w-[52rem] grid-cols-1 rounded-3xl ring-1 ring-line-strong sm:grid sm:grid-cols-[1.4fr_1fr_1fr] sm:rounded-full",
          expanded ? "grid" : "hidden",
          panel ? "bg-surface-2" : "bg-surface shadow-lift",
        )}
      >
        <label
          className={clsx(
            "flex cursor-text flex-col justify-center rounded-full px-8 py-3.5 transition-colors",
            panel === "where" ? "bg-surface shadow-lift" : "hover:bg-surface-2",
          )}
        >
          <span className="text-xs font-bold">{t("where")}</span>
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            onFocus={() => setPanel("where")}
            placeholder={t("wherePlaceholder")}
            className="w-full truncate bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <Segment label={t("when")} active={panel === "when"} onOpen={() => setPanel("when")}>
          <span className={clsx("truncate text-sm", !range.checkOut && "text-muted")}>{dateLabel}</span>
        </Segment>
        <div
          className={clsx(
            "flex items-center gap-2 rounded-full pe-2 transition-colors",
            panel === "who" ? "bg-surface shadow-lift" : "hover:bg-surface-2",
          )}
        >
          <Segment label={t("who")} active={false} onOpen={() => setPanel("who")} plain>
            <span className="truncate text-sm">{t("guests", { count: guests })}</span>
          </Segment>
          <button
            type="submit"
            aria-label={t("submit")}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-strong active:scale-95"
          >
            <Search className="size-[1.125rem]" strokeWidth={2.75} aria-hidden />
          </button>
        </div>

        <AnimatePresence>
          {panel && (
            <motion.div
              key={panel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-30 rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line sm:p-8"
            >
              {panel === "where" && (
                <div>
                  <p className="mb-4 text-sm font-semibold">{t("popular")}</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_AREAS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setArea(name);
                          setPanel("when");
                        }}
                        className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line-strong transition-colors hover:ring-ink"
                      >
                        {t(`areas.${name}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {panel === "when" && <DateRangePicker value={range} onChange={pickRange} />}
              {panel === "who" && (
                <GuestCounter
                  value={guests}
                  onChange={setGuests}
                  label={t("guestsLabel")}
                  hint={t("guestsHint")}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </>
  );
}

function Segment({
  label,
  active,
  onOpen,
  plain = false,
  children,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
  /** Drawn inside a wrapper that owns the background (the guests segment shares it with the search button). */
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={active}
      className={clsx(
        "flex min-w-0 flex-1 flex-col justify-center rounded-full px-8 py-3.5 text-start transition-colors",
        !plain && (active ? "bg-surface shadow-lift" : "hover:bg-surface-2"),
      )}
    >
      <span className="text-xs font-bold">{label}</span>
      {children}
    </button>
  );
}
