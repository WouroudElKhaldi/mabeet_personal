"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass, labelledControlClass } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { addDays, parseIsoDate, toIsoDate, todayUtc } from "@/lib/dates";

export interface ScheduledSession {
  id: string;
  startsAt: string;
  capacity: number;
  seatsTaken: number;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const MAX_SESSIONS = 60;

/** Every date between `from` and `to` (inclusive) that falls on one of the chosen weekdays. */
function datesOn(from: string, to: string, weekdays: ReadonlySet<number>): string[] {
  const dates: string[] = [];
  for (
    let day = parseIsoDate(from);
    day <= parseIsoDate(to) && dates.length < MAX_SESSIONS;
    day = addDays(day, 1)
  ) {
    if (weekdays.has(day.getUTCDay())) dates.push(toIsoDate(day));
  }
  return dates;
}

/** Schedules repeating sessions (e.g. every Saturday at 10:00 for a month) and lists the upcoming ones. */
export function SessionScheduler({
  businessId,
  offeringId,
  defaultCapacity,
  timezone,
  sessions,
}: {
  businessId: string;
  offeringId: string;
  defaultCapacity: number;
  timezone: string;
  sessions: ScheduledSession[];
}) {
  const t = useTranslations("dashboard.offerings");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  /** Runs `action` only after the person confirms. */
  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };
  const [note, setNote] = useState<string | null>(null);
  const today = toIsoDate(addDays(todayUtc(), 1));
  const when = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

  const schedule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const weekdays = new Set(data.getAll("weekday").map(Number));
    const dates = datesOn(String(data.get("from")), String(data.get("to")), weekdays);
    if (dates.length === 0) {
      setNote(t("noDates"));
      return;
    }
    setNote(null);
    run(
      () =>
        api.post<{ added: number }>(`/api/workspaces/${businessId}/offerings/${offeringId}/sessions`, {
          dates,
          time: data.get("time"),
          capacity: Number(data.get("capacity")),
        }),
      () => setNote(t("added", { count: dates.length })),
    );
  };

  return (
    <div className="grid gap-5">
      {confirmDialog}
      <form onSubmit={schedule} className="grid gap-4 rounded-xl bg-surface-2 p-4">
        <p className="font-semibold">{t("schedule")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={labelledControlClass}>
            {t("from")}
            <input
              name="from"
              type="date"
              required
              min={today}
              defaultValue={today}
              className={`${inputClass} h-11`}
            />
          </label>
          <label className={labelledControlClass}>
            {t("to")}
            <input
              name="to"
              type="date"
              required
              min={today}
              defaultValue={toIsoDate(addDays(todayUtc(), 28))}
              className={`${inputClass} h-11`}
            />
          </label>
          <label className={labelledControlClass}>
            {t("time")}
            <input name="time" type="time" required defaultValue="10:00" className={`${inputClass} h-11`} />
          </label>
          <label className={labelledControlClass}>
            {t("capacity")}
            <input
              name="capacity"
              type="number"
              min="1"
              max="500"
              required
              defaultValue={defaultCapacity}
              className={`${inputClass} h-11`}
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted">{t("weekdays")}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-line has-checked:bg-ink has-checked:font-semibold has-checked:text-paper"
              >
                <input
                  type="checkbox"
                  name="weekday"
                  value={day}
                  defaultChecked={day === 6}
                  className="sr-only"
                />
                {t(`weekday.${day}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {t("addSessions")}
          </Button>
          {(error ?? note) && (
            <p role="status" className={error ? "text-sm font-semibold text-danger" : "text-sm text-muted"}>
              {error ?? note}
            </p>
          )}
        </div>
      </form>

      <div>
        <p className="mb-2 font-semibold">{t("upcoming")}</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">{t("noUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{when.format(new Date(session.startsAt))}</span>
                <span className="flex items-center gap-3 text-muted">
                  {t("seats", { taken: session.seatsTaken, capacity: session.capacity })}
                  <button
                    type="button"
                    disabled={pending || session.seatsTaken > 0}
                    aria-label={t("cancelSession")}
                    title={t("cancelSession")}
                    onClick={() =>
                      void confirmThen(
                        {
                          title: tConfirm("cancelSession.title"),
                          body: tConfirm("cancelSession.body"),
                          confirmLabel: tConfirm("cancelSession.confirm"),
                          danger: true,
                        },
                        () => api.delete(`/api/workspaces/${businessId}/sessions/${session.id}`),
                      )
                    }
                    className="grid size-8 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
