"use client";

import { clsx } from "clsx";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { GuestCounter } from "@/components/ui/guest-counter";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";

export interface OpenSession {
  id: string;
  startsAt: string;
  seatsLeft: number;
}

interface SessionBookingCardProps {
  slug: string;
  currency: string;
  priceCents: number;
  priceUnit: "PER_PERSON" | "PER_GROUP";
  maxGuests: number;
  depositPercent: number;
  timezone: string;
  sessions: OpenSession[];
  defaults: { name?: string; email?: string };
}

const FIRST_DAYS_SHOWN = 6;

/** Pick a session, the number of guests and your details; the request holds the seats at once. */
export function SessionBookingCard(props: SessionBookingCardProps) {
  const t = useTranslations("offeringPage");
  const tOffer = useTranslations("offering");
  const locale = useLocale();
  const router = useRouter();
  const [sessionId, setSessionId] = useState(
    props.sessions.find((session) => session.seatsLeft > 0)?.id ?? null,
  );
  const [guests, setGuests] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const money = (cents: number) => formatMoney(cents, props.currency, locale);
  const selected = props.sessions.find((session) => session.id === sessionId) ?? null;
  const maxGuests = Math.max(1, Math.min(props.maxGuests, selected?.seatsLeft ?? props.maxGuests));
  const seats = Math.min(guests, maxGuests);
  const total = props.priceUnit === "PER_PERSON" ? props.priceCents * seats : props.priceCents;
  const deposit = Math.ceil((total * props.depositPercent) / 100);

  const days = useMemo(() => {
    const dayFormat = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: props.timezone,
    });
    const groups = new Map<string, OpenSession[]>();
    for (const session of props.sessions) {
      const day = dayFormat.format(new Date(session.startsAt));
      groups.set(day, [...(groups.get(day) ?? []), session]);
    }
    return [...groups.entries()];
  }, [props.sessions, props.timezone, locale]);
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: props.timezone,
  });
  const shownDays = showAll ? days : days.slice(0, FIRST_DAYS_SHOWN);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const booking = await api.post<{ publicToken: string }>(
        `/api/public/experiences/${props.slug}/bookings`,
        {
          sessionId,
          seats,
          guestName: String(form.get("name")),
          guestPhone: String(form.get("phone")).replace(/[\s-]/g, ""),
          guestEmail: String(form.get("email")) || null,
          guestNote: String(form.get("note")) || null,
        },
      );
      router.push(`/b/${booking.publicToken}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("genericError"));
      setSubmitting(false);
      router.refresh();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-5 rounded-xl bg-surface p-6 shadow-lift ring-1 ring-line-strong"
    >
      <p className="text-[1.375rem]">
        <span className="font-semibold">{money(props.priceCents)}</span>{" "}
        <span className="text-base text-muted">
          {props.priceUnit === "PER_PERSON" ? tOffer("perPerson") : tOffer("perGroup")}
        </span>
      </p>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">{t("chooseTime")}</legend>
        {days.length === 0 && <p className="text-sm text-muted">{t("noSessions")}</p>}
        {shownDays.map(([day, sessions]) => (
          <div key={day} className="grid gap-2">
            <p className="text-xs font-semibold text-muted">{day}</p>
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => {
                const full = session.seatsLeft <= 0;
                const active = session.id === sessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    disabled={full}
                    aria-pressed={active}
                    onClick={() => setSessionId(session.id)}
                    className={clsx(
                      "grid rounded-lg px-3.5 py-2 text-start ring-1 transition-shadow",
                      active ? "ring-2 ring-ink" : "ring-line-strong hover:ring-ink/60",
                      full && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="text-sm font-semibold">
                      {timeFormat.format(new Date(session.startsAt))}
                    </span>
                    <span className="text-xs text-muted">
                      {t("seatsLeft", { count: Math.max(0, session.seatsLeft) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!showAll && days.length > FIRST_DAYS_SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="justify-self-start text-sm font-semibold underline underline-offset-4"
          >
            {t("showMore", { count: days.length - FIRST_DAYS_SHOWN })}
          </button>
        )}
      </fieldset>

      {selected && (
        <>
          <div className="rounded-lg px-4 py-3 ring-1 ring-line-strong">
            <GuestCounter value={seats} onChange={setGuests} label={t("guests")} max={maxGuests} />
          </div>

          <dl className="grid gap-2 border-t border-line pt-4 text-[0.9375rem]">
            <div className="flex justify-between font-semibold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{money(total)}</dd>
            </div>
            <div className="flex justify-between rounded-md bg-accent-soft px-3 py-2 text-sm">
              <dt>{t("deposit")}</dt>
              <dd className="font-semibold tabular-nums">{money(deposit)}</dd>
            </div>
          </dl>

          <fieldset className="grid gap-4 border-t border-line pt-4">
            <legend className="sr-only">{t("yourDetails")}</legend>
            <Field
              label={t("name")}
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              defaultValue={props.defaults.name}
            />
            <Field
              label={t("phone")}
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              pattern="\+?[0-9\s\-]{8,18}"
              defaultValue="+961 "
              hint={t("phoneHint")}
            />
            <Field
              label={t("email")}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={props.defaults.email}
              hint={t("emailHint")}
            />
            <TextArea label={t("note")} name="note" maxLength={1000} />
          </fieldset>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!selected || submitting} className="w-full">
        {submitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("request")}
      </Button>
      <p className="flex items-start justify-center gap-2 text-center text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("noChargeYet")}
      </p>
    </form>
  );
}
