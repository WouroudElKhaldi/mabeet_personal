"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/dates";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

export interface CalendarEntry {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  kind: "DIRECT" | "MANUAL" | "IMPORTED";
  label: string;
  conflict: boolean;
  pending: boolean;
}

interface CalendarBoardProps {
  businessId: string;
  month: string; // YYYY-MM
  rooms: Array<{ id: string; name: string }>;
  entries: CalendarEntry[];
  canEditBlocks: boolean;
}

const KIND_STYLE: Record<CalendarEntry["kind"], string> = {
  DIRECT: "bg-accent text-accent-ink",
  MANUAL: "bg-ink/80 text-paper",
  IMPORTED: "bg-surface-2 text-ink ring-1 ring-line-strong",
};

const DAY_WIDTH = 44;

export function CalendarBoard({ businessId, month, rooms, entries, canEditBlocks }: CalendarBoardProps) {
  const t = useTranslations("dashboard.calendar");
  const locale = useLocale();
  const { run, pending } = useAction();
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  /** Runs `action` only after the person confirms. */
  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };
  const first = parseIsoDate(`${month}-01`);
  const nextMonth = toIsoDate(addDays(first, 32)).slice(0, 7);
  const previousMonth = toIsoDate(addDays(first, -1)).slice(0, 7);
  const days = Array.from({ length: 31 }, (_, index) => addDays(first, index)).filter(
    (day) => toIsoDate(day).slice(0, 7) === month,
  );
  const monthEnd = toIsoDate(addDays(days.at(-1)!, 1));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    first,
  );
  const today = toIsoDate(new Date());

  const position = (entry: CalendarEntry) => {
    const start = entry.checkIn < `${month}-01` ? `${month}-01` : entry.checkIn;
    const end = entry.checkOut > monthEnd ? monthEnd : entry.checkOut;
    const offset = Math.round((parseIsoDate(start).getTime() - first.getTime()) / 86_400_000);
    const length = Math.round((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / 86_400_000);
    return { insetInlineStart: offset * DAY_WIDTH + 4, width: length * DAY_WIDTH - 8 };
  };

  return (
    <div className="rounded-xl bg-surface ring-1 ring-line">
      {confirmDialog}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link
          href={`?month=${previousMonth}`}
          aria-label={t("previous")}
          className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
        <p className="font-display text-xl font-semibold">{title}</p>
        <Link
          href={`?month=${nextMonth}`}
          aria-label={t("next")}
          className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: 160 + days.length * DAY_WIDTH }}>
          <div className="flex border-b border-line">
            <div className="sticky start-0 z-10 w-40 shrink-0 bg-surface" />
            {days.map((day) => {
              const iso = toIsoDate(day);
              return (
                <div
                  key={iso}
                  style={{ width: DAY_WIDTH }}
                  className={clsx(
                    "shrink-0 py-2 text-center text-xs",
                    iso === today ? "font-bold text-accent" : "text-muted",
                  )}
                >
                  <div>{weekday.format(day)}</div>
                  <div className="font-semibold">{day.getUTCDate()}</div>
                </div>
              );
            })}
          </div>
          {rooms.map((room) => (
            <div key={room.id} className="flex border-b border-line last:border-0">
              <div className="sticky start-0 z-10 flex w-40 shrink-0 items-center bg-surface px-4 py-3 text-sm font-semibold">
                <span className="truncate">{room.name}</span>
              </div>
              <div className="relative h-14 shrink-0" style={{ width: days.length * DAY_WIDTH }}>
                {entries
                  .filter((entry) => entry.roomId === room.id)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      title={entry.label}
                      style={position(entry)}
                      className={clsx(
                        "absolute top-2.5 flex h-9 items-center gap-1 overflow-hidden rounded-md px-2.5 text-xs font-semibold shadow-soft transition-transform hover:-translate-y-0.5",
                        KIND_STYLE[entry.kind],
                        entry.pending &&
                          "[background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.18)_6px_12px)] opacity-70",
                        entry.conflict && "ring-2 ring-danger",
                      )}
                    >
                      <span className="truncate">{entry.label}</span>
                      {canEditBlocks && entry.kind === "MANUAL" && (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={t("removeBlock")}
                          onClick={() =>
                            void confirmThen(
                              {
                                title: tConfirm("removeBlock.title"),
                                body: tConfirm("removeBlock.body"),
                                confirmLabel: tConfirm("removeBlock.confirm"),
                                danger: true,
                              },
                              () => api.delete(`/api/workspaces/${businessId}/blocks/${entry.id}`),
                            )
                          }
                          className="ms-auto grid size-5 shrink-0 place-items-center rounded-full hover:bg-paper/20"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs text-muted">
        {(Object.keys(KIND_STYLE) as CalendarEntry["kind"][]).map((kind) => (
          <li key={kind} className="flex items-center gap-2">
            <span className={clsx("size-3 rounded", KIND_STYLE[kind])} aria-hidden />
            {t(`legend.${kind}`)}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-3 rounded ring-2 ring-danger" aria-hidden />
          {t("legend.conflict")}
        </li>
      </ul>
    </div>
  );
}
