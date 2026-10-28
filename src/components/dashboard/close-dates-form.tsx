"use client";

import { clsx } from "clsx";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { BLOCK_SOURCES } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { shiftDay } from "./calendar-model";

/** Nights being closed on the calendar: the first and last night (inclusive), until the last one is picked. */
export interface BlockDraft {
  start: string;
  end: string | null;
  roomId: string;
}

/**
 * Closes a range of nights in one room (maintenance, or a booking taken by phone or on Kazderni). The range comes
 * from the calendar (two clicks or a double-click) and can be adjusted here before saving.
 */
export function CloseDatesForm({
  businessId,
  draft,
  rooms,
  formatDay,
  onChange,
  onClose,
}: {
  businessId: string;
  draft: BlockDraft;
  rooms: Array<{ id: string; name: string }>;
  formatDay: (iso: string) => string;
  onChange: (draft: BlockDraft) => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.calendar");
  const { run, pending, error } = useAction();
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");

  const save = () => {
    if (!draft.end || !draft.roomId) return;
    run(
      () =>
        api.post(`/api/workspaces/${businessId}/blocks`, {
          roomId: draft.roomId,
          checkIn: draft.start,
          // The form picks the last night; the stay ends the morning after it.
          checkOut: shiftDay(draft.end!, 1),
          source: source || null,
          note: note.trim() || null,
        }),
      onClose,
    );
  };

  return (
    <div className="grid gap-3 rounded-xl bg-surface p-5 ring-1 ring-accent sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
      <p className="flex items-center gap-2 font-semibold sm:col-span-2 lg:col-span-6">
        <Lock className="size-4 text-accent" aria-hidden />
        {draft.end === null
          ? t("pickLastNight")
          : t("closeRange", { from: formatDay(draft.start), to: formatDay(draft.end) })}
      </p>
      <label className="grid gap-1 text-xs font-semibold">
        {t("room")}
        <select
          value={draft.roomId}
          onChange={(event) => onChange({ ...draft, roomId: event.target.value })}
          className={clsx(inputClass, "h-10")}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        {t("from")}
        <input
          type="date"
          value={draft.start}
          onChange={(event) => event.target.value && onChange({ ...draft, start: event.target.value })}
          className={clsx(inputClass, "h-10")}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        {t("lastNight")}
        <input
          type="date"
          value={draft.end ?? draft.start}
          min={draft.start}
          onChange={(event) => event.target.value && onChange({ ...draft, end: event.target.value })}
          className={clsx(inputClass, "h-10")}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        {t("source")}
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className={clsx(inputClass, "h-10")}
        >
          <option value="">{t("sources.NONE")}</option>
          {BLOCK_SOURCES.map((value) => (
            <option key={value} value={value}>
              {t(`sources.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        {t("note")}
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          className={clsx(inputClass, "h-10")}
        />
      </label>
      <div className="flex gap-2">
        <Button disabled={pending || draft.end === null} onClick={save}>
          {t("block")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
      <FormError message={error} className="sm:col-span-2 lg:col-span-6" />
    </div>
  );
}
