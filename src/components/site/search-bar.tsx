"use client";

import { clsx } from "clsx";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DateRangePicker, type StayRange } from "@/components/ui/date-range-picker";
import { GuestCounter } from "@/components/ui/guest-counter";
import { formatStayDates } from "@/lib/format";
import { parseIsoDate } from "@/lib/dates";

type Panel = "where" | "when" | "who" | null;

export interface SearchDefaults {
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

const POPULAR_AREAS = ["Batroun", "Byblos", "Chouf", "Ehden", "Tannourine", "Jezzine", "Douma", "Tyre"];

export function SearchBar({
  defaults = {},
  compact = false,
}: {
  defaults?: SearchDefaults;
  compact?: boolean;
}) {
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

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams({ guests: String(guests) });
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

  return (
    <form
      ref={root}
      onSubmit={submit}
      role="search"
      className={clsx(
        "relative grid w-full grid-cols-1 rounded-[1.75rem] bg-surface shadow-lift ring-1 ring-line sm:grid-cols-[1.3fr_1fr_0.9fr_auto] sm:rounded-full",
        compact ? "max-w-3xl" : "max-w-4xl",
      )}
    >
      <Segment
        icon={<MapPin />}
        label={t("where")}
        active={panel === "where"}
        onClick={() => setPanel("where")}
      >
        <input
          value={area}
          onChange={(event) => setArea(event.target.value)}
          onFocus={() => setPanel("where")}
          placeholder={t("wherePlaceholder")}
          aria-label={t("where")}
          className="w-full truncate bg-transparent text-[0.9375rem] font-semibold outline-none placeholder:font-normal placeholder:text-faint"
        />
      </Segment>
      <Segment
        icon={<CalendarDays />}
        label={t("when")}
        active={panel === "when"}
        onClick={() => setPanel("when")}
      >
        <span className={clsx("truncate text-[0.9375rem]", range.checkOut ? "font-semibold" : "text-faint")}>
          {dateLabel}
        </span>
      </Segment>
      <Segment icon={<Users />} label={t("who")} active={panel === "who"} onClick={() => setPanel("who")}>
        <span className="text-[0.9375rem] font-semibold">{t("guests", { count: guests })}</span>
      </Segment>
      <div className="p-2">
        <button
          type="submit"
          className="flex h-full min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink transition-[background-color,transform] duration-300 hover:bg-accent-strong active:scale-95"
        >
          <Search className="size-4.5" aria-hidden />
          <span className="sm:sr-only lg:not-sr-only">{t("submit")}</span>
        </button>
      </div>

      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-30 rounded-xl bg-surface p-5 shadow-lift ring-1 ring-line sm:p-6"
          >
            {panel === "where" && (
              <div>
                <p className="mb-3 text-xs font-bold tracking-[0.14em] text-muted uppercase">
                  {t("popular")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_AREAS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setArea(name);
                        setPanel("when");
                      }}
                      className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-accent-soft hover:ring-accent-line"
                    >
                      {name}
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
  );
}

function Segment({
  icon,
  label,
  active,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative flex cursor-pointer items-center gap-3 rounded-full px-6 py-3.5 transition-colors duration-300 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-muted",
        active ? "bg-surface-2" : "hover:bg-surface-2/60",
      )}
    >
      {icon}
      <div className="grid min-w-0 flex-1">
        <span className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted uppercase">{label}</span>
        {children}
      </div>
    </div>
  );
}
