"use client";

import { clsx } from "clsx";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, GanttChart, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type DragEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { useStoredChoice } from "@/hooks/use-stored-choice";
import { api } from "@/lib/api-client";
import { parseIsoDate } from "@/lib/dates";
import {
  assignLanes,
  type CalendarEntry,
  covers,
  ENTRY_KINDS,
  type EntryKind,
  isWeekend,
  KIND_STYLE,
  nightsBetween,
  PENDING_STYLE,
  shiftDay,
} from "./calendar-model";
import { CalendarSidePanel } from "./calendar-side-panel";
import { type BlockDraft, CloseDatesForm } from "./close-dates-form";

interface CalendarBoardProps {
  businessId: string;
  month: string; // YYYY-MM
  /** The Monday the six-week grid starts on (YYYY-MM-DD). */
  gridStart: string;
  today: string;
  rooms: Array<{ id: string; name: string }>;
  entries: CalendarEntry[];
  /** The next seven days, for "Coming up". */
  comingUp: CalendarEntry[];
  canEditBlocks: boolean;
}

const VIEWS = ["month", "week", "timeline"] as const;
type View = (typeof VIEWS)[number];
const DAY_WIDTH = 44;
const DRAG_TYPE = "application/x-mabeet-block";
const VIEW_KEY = "calendar-view";

export function CalendarBoard(props: CalendarBoardProps) {
  const { businessId, month, gridStart, today, rooms, entries, comingUp, canEditBlocks } = props;
  const t = useTranslations("dashboard.calendar");
  const tConfirm = useTranslations("confirm");
  const locale = useLocale();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [ask, confirmDialog] = useConfirm();

  const [view, chooseView] = useStoredChoice<View>(VIEW_KEY, VIEWS, "month");

  const gridDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => shiftDay(gridStart, index)),
    [gridStart],
  );
  const inMonth = (day: string) => day.startsWith(month);
  const [selectedDay, setSelectedDay] = useState(() => (today.startsWith(month) ? today : `${month}-01`));
  const [weekIndex, setWeekIndex] = useState(() =>
    Math.max(0, Math.floor(gridDays.indexOf(selectedDay) / 7)),
  );
  const [roomId, setRoomId] = useState("all");
  const [layers, setLayers] = useState<Record<EntryKind, boolean>>({
    DIRECT: true,
    MANUAL: true,
    IMPORTED: true,
  });
  const [openEntry, setOpenEntry] = useState<CalendarEntry | null>(null);
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const first = parseIsoDate(`${month}-01`);
  const previousMonth = shiftDay(`${month}-01`, -1).slice(0, 7);
  const nextMonth = shiftDay(`${month}-01`, 32).slice(0, 7);
  const roomName = (id: string) => rooms.find((room) => room.id === id)?.name ?? "";
  const visible = entries.filter(
    (entry) => layers[entry.kind] && (roomId === "all" || entry.roomId === roomId),
  );
  const lanes = useMemo(() => assignLanes(visible), [visible]);
  const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(parseIsoDate(iso));
  const weekNames = Array.from({ length: 7 }, (_, index) =>
    fmt(shiftDay("2024-01-01", index), { weekday: "short" }),
  );
  const week = gridDays.slice(weekIndex * 7, weekIndex * 7 + 7);

  const title =
    view === "week"
      ? `${fmt(week[0]!, { day: "numeric", month: "short" })} – ${fmt(week[6]!, { day: "numeric", month: "short", year: "numeric" })}`
      : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  /** Arrows: by month, or by week inside the six-week grid, moving to the next month at its edges. */
  const step = (direction: -1 | 1) => {
    if (view !== "week") return router.push(`?month=${direction === 1 ? nextMonth : previousMonth}`);
    const next = weekIndex + direction;
    if (next < 0) return router.push(`?month=${previousMonth}`);
    if (next > 5) return router.push(`?month=${nextMonth}`);
    setWeekIndex(next);
  };
  const goToday = () => {
    if (!today.startsWith(month)) return router.push(`?month=${today.slice(0, 7)}`);
    setSelectedDay(today);
    setWeekIndex(Math.floor(gridDays.indexOf(today) / 7));
  };

  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };

  // ---------- Closing dates: click two days, double-click one, or the "Close dates" button ----------
  const startDraft = (day: string, forRoom = roomId === "all" ? (rooms[0]?.id ?? "") : roomId) => {
    if (!canEditBlocks) return;
    setOpenEntry(null);
    // The last night comes from the next day clicked, or the date field.
    setDraft({ start: day, end: null, roomId: forRoom });
  };
  const clickDay = (day: string) => {
    setSelectedDay(day);
    setOpenEntry(null);
    // A draft waiting for its last night takes this click as the end of the range.
    if (draft && draft.end === null) {
      const [start, end] = day < draft.start ? [day, draft.start] : [draft.start, day];
      setDraft({ ...draft, start, end });
    }
  };
  const inDraft = (day: string, forRoom?: string) =>
    draft !== null &&
    (forRoom === undefined || draft.roomId === forRoom) &&
    day >= draft.start &&
    day <= (draft.end ?? draft.start);

  // ---------- Drag and drop: blocks move to another day (and, on the timeline, another room) ----------
  const dragStart = (event: DragEvent, entry: CalendarEntry) => {
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        id: entry.id,
        nights: nightsBetween(entry.checkIn, entry.checkOut),
        roomId: entry.roomId,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  };
  const dropProps = (day: string, forRoom?: string) =>
    canEditBlocks
      ? {
          onDragOver: (event: DragEvent) => {
            if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            setDropDay(`${forRoom ?? ""}|${day}`);
          },
          onDragLeave: () => setDropDay(null),
          onDrop: (event: DragEvent) => {
            event.preventDefault();
            setDropDay(null);
            const raw = event.dataTransfer.getData(DRAG_TYPE);
            if (!raw) return;
            const moved = JSON.parse(raw) as { id: string; nights: number; roomId: string };
            run(() =>
              api.patch(`/api/workspaces/${businessId}/blocks/${moved.id}`, {
                roomId: forRoom ?? moved.roomId,
                checkIn: day,
                checkOut: shiftDay(day, moved.nights),
              }),
            );
          },
        }
      : {};
  const isDropTarget = (day: string, forRoom?: string) => dropDay === `${forRoom ?? ""}|${day}`;

  const chip = (entry: CalendarEntry, day: string, rowStart: boolean, tall = false) => {
    const starts = entry.checkIn === day || rowStart;
    const ends = shiftDay(day, 1) === entry.checkOut;
    const movable = canEditBlocks && entry.kind === "MANUAL";
    return (
      <button
        key={entry.id}
        type="button"
        draggable={movable}
        onDragStart={movable ? (event) => dragStart(event, entry) : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setDraft(null);
          setOpenEntry(entry);
        }}
        title={`${entry.label} · ${roomName(entry.roomId)}`}
        className={clsx(
          "flex w-full items-center truncate px-1.5 text-start text-[0.6875rem] leading-none font-semibold",
          tall ? "h-7" : "h-6",
          KIND_STYLE[entry.kind],
          entry.pending && PENDING_STYLE,
          entry.conflict && "ring-2 ring-danger ring-inset",
          movable && "cursor-grab active:cursor-grabbing",
          starts ? "ms-0.5 rounded-s-md" : "-ms-px",
          ends ? "me-0.5 rounded-e-md" : "-me-px",
        )}
      >
        {starts && (
          <span className="truncate">
            {roomId === "all" && rooms.length > 1 ? `${roomName(entry.roomId)} · ` : ""}
            {entry.label}
          </span>
        )}
      </button>
    );
  };

  /** One day square, in the month or the week view. */
  const dayCell = (day: string, index: number, lanesShown: number, tall: boolean) => {
    const here = visible.filter((entry) => covers(entry, day));
    const byLane = new Map(here.map((entry) => [lanes.get(entry.id) ?? 0, entry]));
    const hidden = here.filter((entry) => (lanes.get(entry.id) ?? 0) >= lanesShown).length;
    return (
      <div
        key={day}
        role="button"
        tabIndex={0}
        aria-label={fmt(day, { weekday: "long", day: "numeric", month: "long" })}
        aria-pressed={day === selectedDay}
        onClick={() => clickDay(day)}
        onDoubleClick={() => startDraft(day)}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && clickDay(day)}
        {...dropProps(day)}
        className={clsx(
          "cursor-pointer border-e border-b border-line pt-1 pb-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
          tall ? "min-h-64" : "min-h-24 sm:min-h-28",
          (index + 1) % 7 === 0 && "border-e-0",
          !inMonth(day) && view === "month" && "bg-surface-2/60 text-faint",
          isWeekend(day) && inMonth(day) && "bg-surface-2/30",
          day === selectedDay && "bg-accent/10",
          inDraft(day) && "bg-accent/20",
          isDropTarget(day) && "bg-glow/20 ring-2 ring-glow ring-inset",
          "hover:bg-surface-2",
        )}
      >
        <p className="mb-1 flex items-center justify-between px-1.5">
          {tall && <span className="text-xs font-semibold text-muted">{weekNames[index % 7]}</span>}
          <span
            className={clsx(
              "ms-auto inline-grid size-6 place-items-center rounded-full text-xs font-semibold",
              day === today
                ? "bg-accent text-accent-ink"
                : inMonth(day) || view === "week"
                  ? "text-ink"
                  : "text-faint",
            )}
          >
            {parseIsoDate(day).getUTCDate()}
          </span>
        </p>
        <div className="grid gap-0.5">
          {Array.from(
            { length: Math.min(lanesShown, Math.max(...[...byLane.keys(), -1]) + 1) },
            (_, lane) => {
              const entry = byLane.get(lane);
              return entry ? (
                chip(entry, day, index % 7 === 0, tall)
              ) : (
                <span key={lane} className={tall ? "h-7" : "h-6"} aria-hidden />
              );
            },
          )}
          {hidden > 0 && (
            <p className="px-1.5 text-[0.6875rem] font-semibold text-muted">{t("more", { count: hidden })}</p>
          )}
        </div>
      </div>
    );
  };

  const removeBlock = (entry: CalendarEntry) =>
    void confirmThen(
      {
        title: tConfirm("removeBlock.title"),
        body: tConfirm("removeBlock.body"),
        confirmLabel: tConfirm("removeBlock.confirm"),
        danger: true,
      },
      async () => {
        await api.delete(`/api/workspaces/${businessId}/blocks/${entry.id}`);
        setOpenEntry(null);
      },
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      {confirmDialog}
      <div className="grid min-w-0 content-start gap-4">
        <div className="rounded-xl bg-surface ring-1 ring-line">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t("previous")}
                className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
              >
                <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t("next")}
                className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
              >
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-full px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"
            >
              {t("today")}
            </button>
            <p className="me-auto px-1 font-display text-lg font-semibold sm:text-xl">{title}</p>
            <div className="flex rounded-full bg-surface-2 p-1" role="tablist" aria-label={t("view")}>
              {(
                [
                  ["month", CalendarDays],
                  ["week", CalendarRange],
                  ["timeline", GanttChart],
                ] as const
              ).map(([option, Icon]) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  onClick={() => chooseView(option)}
                  className={clsx(
                    "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors sm:px-3",
                    view === option ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">{t(option)}</span>
                </button>
              ))}
            </div>
            {canEditBlocks && rooms.length > 0 && (
              <Button size="sm" onClick={() => startDraft(selectedDay)}>
                <Plus className="size-4" aria-hidden />
                {t("closeDates")}
              </Button>
            )}
          </div>

          {/* Filters: room and what to show */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
            {rooms.length > 1 && (
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                aria-label={t("room")}
                className={clsx(inputClass, "h-8 w-auto py-0 text-xs")}
              >
                <option value="all">{t("allRooms")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("show")}>
              {ENTRY_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={layers[kind]}
                  onClick={() => setLayers((current) => ({ ...current, [kind]: !current[kind] }))}
                  className={clsx(
                    "flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-opacity",
                    layers[kind] ? "ring-line-strong" : "opacity-50 ring-line",
                  )}
                >
                  <span className={clsx("size-2.5 rounded-sm", KIND_STYLE[kind])} aria-hidden />
                  {t(`legend.${kind}`)}
                </button>
              ))}
            </div>
            <span className="ms-auto hidden items-center gap-3 text-xs text-muted lg:flex">
              <span className="flex items-center gap-1.5">
                <span className={clsx("size-2.5 rounded-sm bg-accent", PENDING_STYLE)} aria-hidden />
                {t("legend.pending")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm ring-2 ring-danger" aria-hidden />
                {t("legend.conflict")}
              </span>
            </span>
          </div>

          {view !== "timeline" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-line">
                {weekNames.map((name, index) => (
                  <p
                    key={name}
                    className={clsx(
                      "py-2 text-center text-xs font-semibold",
                      index >= 5 ? "text-faint" : "text-muted",
                    )}
                  >
                    {view === "week" ? `${name} ${parseIsoDate(week[index]!).getUTCDate()}` : name}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {(view === "month" ? gridDays : week).map((day, index) =>
                  dayCell(day, index, view === "month" ? 3 : 8, view === "week"),
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ width: 160 + gridDays.filter(inMonth).length * DAY_WIDTH }}>
                <div className="flex border-b border-line">
                  <div className="sticky start-0 z-10 w-40 shrink-0 bg-surface" />
                  {gridDays.filter(inMonth).map((day) => (
                    <div
                      key={day}
                      style={{ width: DAY_WIDTH }}
                      className={clsx(
                        "shrink-0 py-2 text-center text-xs",
                        day === today ? "font-bold text-accent" : "text-muted",
                        isWeekend(day) && "bg-surface-2/60",
                      )}
                    >
                      <div>{fmt(day, { weekday: "narrow" })}</div>
                      <div className="font-semibold">{parseIsoDate(day).getUTCDate()}</div>
                    </div>
                  ))}
                </div>
                {rooms
                  .filter((room) => roomId === "all" || room.id === roomId)
                  .map((room) => {
                    const days = gridDays.filter(inMonth);
                    const monthStart = days[0]!;
                    const monthEnd = shiftDay(days.at(-1)!, 1);
                    return (
                      <div key={room.id} className="flex border-b border-line last:border-0">
                        <div className="sticky start-0 z-10 flex w-40 shrink-0 items-center bg-surface px-4 py-3 text-sm font-semibold">
                          <span className="truncate">{room.name}</span>
                        </div>
                        <div className="relative h-14 shrink-0" style={{ width: days.length * DAY_WIDTH }}>
                          <div className="absolute inset-0 flex">
                            {days.map((day) => (
                              <button
                                key={day}
                                type="button"
                                tabIndex={-1}
                                aria-label={`${room.name}, ${fmt(day, { day: "numeric", month: "long" })}`}
                                onClick={() => {
                                  if (draft && draft.end === null && draft.roomId === room.id)
                                    return clickDay(day);
                                  setSelectedDay(day);
                                }}
                                onDoubleClick={() => startDraft(day, room.id)}
                                {...dropProps(day, room.id)}
                                style={{ width: DAY_WIDTH }}
                                className={clsx(
                                  "h-full shrink-0 border-e border-line/70 hover:bg-surface-2",
                                  isWeekend(day) && "bg-surface-2/60",
                                  day === today && "bg-accent/10",
                                  inDraft(day, room.id) && "bg-accent/25",
                                  isDropTarget(day, room.id) && "bg-glow/25",
                                )}
                              />
                            ))}
                          </div>
                          {visible
                            .filter(
                              (entry) =>
                                entry.roomId === room.id &&
                                entry.checkOut > monthStart &&
                                entry.checkIn < monthEnd,
                            )
                            .map((entry) => {
                              const start = entry.checkIn < monthStart ? monthStart : entry.checkIn;
                              const end = entry.checkOut > monthEnd ? monthEnd : entry.checkOut;
                              const movable = canEditBlocks && entry.kind === "MANUAL";
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  title={entry.label}
                                  draggable={movable}
                                  onDragStart={movable ? (event) => dragStart(event, entry) : undefined}
                                  onClick={() => {
                                    setDraft(null);
                                    setOpenEntry(entry);
                                  }}
                                  style={{
                                    insetInlineStart: nightsBetween(monthStart, start) * DAY_WIDTH + 3,
                                    width: nightsBetween(start, end) * DAY_WIDTH - 6,
                                  }}
                                  className={clsx(
                                    "absolute top-2.5 flex h-9 items-center overflow-hidden rounded-md px-2.5 text-xs font-semibold shadow-soft",
                                    KIND_STYLE[entry.kind],
                                    entry.pending && PENDING_STYLE,
                                    entry.conflict && "ring-2 ring-danger",
                                    movable && "cursor-grab active:cursor-grabbing",
                                  )}
                                >
                                  <span className="truncate">{entry.label}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {canEditBlocks && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">{t("hint")}</p>
          )}
        </div>

        {draft && (
          <CloseDatesForm
            businessId={businessId}
            draft={draft}
            rooms={rooms}
            formatDay={(iso) => fmt(iso, { day: "numeric", month: "short" })}
            onChange={setDraft}
            onClose={() => setDraft(null)}
          />
        )}
        <FormError message={error} className="rounded-lg bg-danger/10 px-4 py-3" />
      </div>

      <CalendarSidePanel
        businessId={businessId}
        rooms={rooms}
        entries={entries}
        comingUp={comingUp}
        today={today}
        selectedDay={selectedDay}
        layers={layers}
        openEntry={openEntry}
        canEditBlocks={canEditBlocks}
        busy={pending}
        formatDay={fmt}
        onOpenEntry={setOpenEntry}
        onCloseEntry={() => setOpenEntry(null)}
        onRemoveBlock={removeBlock}
        onCloseDates={startDraft}
      />
    </div>
  );
}
