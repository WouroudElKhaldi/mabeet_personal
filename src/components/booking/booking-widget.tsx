"use client";

import { clsx } from "clsx";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { DateRangePicker, type StayRange } from "@/components/ui/date-range-picker";
import { GuestCounter } from "@/components/ui/guest-counter";
import { Skeleton } from "@/components/ui/skeleton";
import { parseIsoDate } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { PriceBreakdown } from "./price-breakdown";
import { useRoomQuote, useTakenNights } from "./use-room-calendar";

interface BookableRoom {
  id: string;
  name: string;
  capacity: number;
  baseRateCents: number;
}

interface BookingWidgetProps {
  slug: string;
  currency: string;
  rooms: BookableRoom[];
  initial: { roomId?: string; checkIn?: string; checkOut?: string; guests?: number };
}

export function BookingWidget({ slug, currency, rooms, initial }: BookingWidgetProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [roomId, setRoomId] = useState(initial.roomId ?? rooms[0]!.id);
  const room = rooms.find((candidate) => candidate.id === roomId) ?? rooms[0]!;
  const [range, setRange] = useState<StayRange>({
    checkIn: initial.checkIn ?? null,
    checkOut: initial.checkOut ?? null,
  });
  const [guests, setGuests] = useState(Math.min(initial.guests ?? 2, room.capacity));
  const [pickingDates, setPickingDates] = useState(false);
  const taken = useTakenNights(slug, room.id);
  const quote = useRoomQuote(slug, room.id, range.checkIn, range.checkOut);

  const chooseRoom = (id: string) => {
    setRoomId(id);
    setRange({ checkIn: null, checkOut: null });
  };

  const pickRange = (next: StayRange) => {
    setRange(next);
    if (next.checkOut) setPickingDates(false);
  };

  const bookHref =
    range.checkIn && range.checkOut
      ? `/p/${slug}/book?${new URLSearchParams({ roomId: room.id, checkIn: range.checkIn, checkOut: range.checkOut, guests: String(guests) })}`
      : null;
  const canBook = Boolean(bookHref && quote?.free);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-lift ring-1 ring-line-strong">
      <p className="text-[1.375rem]">
        <span className="font-semibold">{formatMoney(room.baseRateCents, currency, locale)}</span>{" "}
        <span className="text-base text-muted">{t("perNight")}</span>
      </p>

      {rooms.length > 1 && (
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-bold">{t("room")}</legend>
          <div className="grid gap-2">
            {rooms.map((option) => (
              <label
                key={option.id}
                className={clsx(
                  "flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 ring-1 transition-shadow",
                  option.id === room.id ? "ring-2 ring-ink" : "ring-line-strong hover:ring-ink/50",
                )}
              >
                <input
                  type="radio"
                  name="room"
                  value={option.id}
                  checked={option.id === room.id}
                  onChange={() => chooseRoom(option.id)}
                  className="sr-only"
                />
                <span className="font-semibold">{option.name}</span>
                <span className="text-sm text-muted">{t("sleeps", { count: option.capacity })}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={() => setPickingDates((open) => !open)}
        aria-expanded={pickingDates}
        className="mt-5 flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-start ring-1 ring-line-strong transition-shadow hover:ring-ink/50"
      >
        <CalendarDays className="size-5 text-muted" aria-hidden />
        <span className="grid">
          <span className="text-[0.625rem] font-bold tracking-wide uppercase">{t("dates")}</span>
          <span className={clsx("font-semibold", !range.checkOut && "font-normal text-faint")}>
            {range.checkIn && range.checkOut
              ? formatStayDates(parseIsoDate(range.checkIn), parseIsoDate(range.checkOut), locale)
              : t("addDates")}
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {pickingDates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <DateRangePicker value={range} onChange={pickRange} taken={taken} months={1} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-b-lg px-4 py-3 ring-1 ring-line-strong">
        <GuestCounter value={guests} onChange={setGuests} label={t("guests")} max={room.capacity} />
      </div>

      {range.checkIn && range.checkOut && !quote && (
        <div className="mt-5 grid gap-2 border-t border-line pt-4" aria-hidden>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      <AnimatePresence>
        {quote && (
          <div className="mt-5">
            {quote.free ? (
              <PriceBreakdown quote={quote} />
            ) : (
              <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                {t("justTaken")}
              </p>
            )}
          </div>
        )}
      </AnimatePresence>

      {canBook && bookHref ? (
        <ButtonLink href={bookHref} size="lg" className="mt-5 w-full">
          {t("request")}
          <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
        </ButtonLink>
      ) : (
        <button
          type="button"
          onClick={() => setPickingDates(true)}
          className="mt-5 h-12 w-full rounded-lg bg-accent font-semibold text-accent-ink transition-colors hover:bg-accent-strong"
        >
          {t("pickDatesFirst")}
        </button>
      )}

      <p className="mt-4 flex items-start justify-center gap-2 text-center text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("noChargeYet")}
      </p>
    </div>
  );
}
