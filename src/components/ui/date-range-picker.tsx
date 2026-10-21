"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { type MonthCursor, monthGrid, monthOf, rangeHitsTaken, shiftMonth } from "@/lib/calendar-grid";
import { toIsoDate, todayUtc } from "@/lib/dates";

export interface StayRange {
  checkIn: string | null;
  checkOut: string | null;
}

interface DateRangePickerProps {
  value: StayRange;
  onChange: (range: StayRange) => void;
  /** Nights (ISO dates) that cannot be slept in. A taken night can still be a check-out day. */
  taken?: ReadonlySet<string>;
  months?: 1 | 2;
}

const WEEK_STARTS_ON = 1;

function weekdayLabels(locale: string): string[] {
  const monday = new Date(Date.UTC(2024, 0, 1));
  const format = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(monday.getTime() + ((index + WEEK_STARTS_ON - 1 + 7) % 7) * 86_400_000)),
  );
}

export function DateRangePicker({ value, onChange, taken = new Set(), months = 2 }: DateRangePickerProps) {
  const t = useTranslations("dates");
  const locale = useLocale();
  const today = toIsoDate(todayUtc());
  const [cursor, setCursor] = useState<MonthCursor>(() => monthOf(value.checkIn ?? today));
  const [hovered, setHovered] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const labels = useMemo(() => weekdayLabels(locale), [locale]);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });

  const choosingCheckOut = value.checkIn !== null && value.checkOut === null;
  const previewEnd = choosingCheckOut ? hovered : value.checkOut;

  const isDisabled = (day: string) => {
    if (day < today) return true;
    if (!choosingCheckOut) return taken.has(day);
    return day <= value.checkIn! ? taken.has(day) : rangeHitsTaken(value.checkIn!, day, taken);
  };

  const pick = (day: string) => {
    if (choosingCheckOut && day > value.checkIn!) onChange({ checkIn: value.checkIn, checkOut: day });
    else onChange({ checkIn: day, checkOut: null });
  };

  const move = (delta: number) => {
    setDirection(delta);
    setCursor((current) => shiftMonth(current, delta));
  };

  const canGoBack = cursor.year > monthOf(today).year || cursor.month > monthOf(today).month;

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canGoBack}
          aria-label={t("previousMonth")}
          className="grid size-9 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </button>
        <p className="text-xs font-semibold text-muted">
          {choosingCheckOut ? t("chooseCheckOut") : t("chooseCheckIn")}
        </p>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label={t("nextMonth")}
          className="grid size-9 place-items-center rounded-full transition-colors hover:bg-surface-2"
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <div className="overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={`${cursor.year}-${cursor.month}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={clsx("grid gap-8", months === 2 && "sm:grid-cols-2")}
          >
            {Array.from({ length: months }, (_, offset) => {
              const month = shiftMonth(cursor, offset);
              return (
                <div key={offset} className={clsx(offset > 0 && "hidden sm:block")}>
                  <p className="mb-3 text-center font-display text-lg font-semibold">
                    {monthName.format(new Date(Date.UTC(month.year, month.month, 1)))}
                  </p>
                  <div className="grid grid-cols-7 text-center text-xs font-semibold text-faint">
                    {labels.map((label, index) => (
                      <span key={index} className="py-1.5">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthGrid(month, WEEK_STARTS_ON).map((day, index) =>
                      day === null ? (
                        <span key={`pad-${index}`} />
                      ) : (
                        <DayCell
                          key={day}
                          day={day}
                          start={value.checkIn}
                          end={previewEnd}
                          disabled={isDisabled(day)}
                          taken={taken.has(day)}
                          isToday={day === today}
                          onPick={pick}
                          onHover={setHovered}
                        />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface DayCellProps {
  day: string;
  start: string | null;
  end: string | null;
  disabled: boolean;
  taken: boolean;
  isToday: boolean;
  onPick: (day: string) => void;
  onHover: (day: string | null) => void;
}

function DayCell({ day, start, end, disabled, taken, isToday, onPick, onHover }: DayCellProps) {
  const isStart = day === start;
  const isEnd = day === end;
  const inRange = start !== null && end !== null && day > start && day < end;
  return (
    <div
      className={clsx(
        "relative h-11",
        inRange && "bg-accent-soft",
        isStart &&
          end &&
          end > day &&
          "bg-gradient-to-r from-transparent from-50% to-accent-soft to-50% rtl:bg-gradient-to-l",
        isEnd &&
          start &&
          start < day &&
          "bg-gradient-to-l from-transparent from-50% to-accent-soft to-50% rtl:bg-gradient-to-r",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(day)}
        onMouseEnter={() => onHover(day)}
        onMouseLeave={() => onHover(null)}
        aria-pressed={isStart || isEnd}
        aria-label={day}
        className={clsx(
          "relative mx-auto grid size-11 place-items-center rounded-full text-sm font-semibold transition-[background-color,transform,color] duration-200",
          isStart || isEnd
            ? "scale-100 bg-accent text-accent-ink shadow-soft"
            : "hover:scale-105 hover:ring-1 hover:ring-ink/60",
          disabled && "cursor-not-allowed text-faint hover:scale-100 hover:ring-0",
          taken && "line-through decoration-faint/70",
        )}
      >
        {Number(day.slice(8))}
        {isToday && !isStart && !isEnd && (
          <span className="absolute bottom-1.5 size-1 rounded-full bg-accent" />
        )}
      </button>
    </div>
  );
}
