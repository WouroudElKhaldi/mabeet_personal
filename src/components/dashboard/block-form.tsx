"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "./use-action";

const SOURCES = ["", "KAZDERNI", "OTHER"] as const;

/** Close dates by hand: maintenance, a walk-in, or a booking taken on Kazderni or by phone. */
export function BlockForm({
  businessId,
  rooms,
}: {
  businessId: string;
  rooms: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("dashboard.calendar");
  const { run, pending, error } = useAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        api.post(`/api/workspaces/${businessId}/blocks`, {
          roomId: data.get("roomId"),
          checkIn: data.get("checkIn"),
          checkOut: data.get("checkOut"),
          source: data.get("source") || null,
          note: data.get("note") || null,
        }),
      () => form.reset(),
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <Lock className="size-4 text-accent" aria-hidden />
        {t("blockTitle")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("room")}
          <select name="roomId" required className={`${inputClass} h-11`}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("from")}
          <input name="checkIn" type="date" required className={`${inputClass} h-11`} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("to")}
          <input name="checkOut" type="date" required className={`${inputClass} h-11`} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("source")}
          <select name="source" className={`${inputClass} h-11`}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(`sources.${source || "NONE"}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("note")}
          <input name="note" maxLength={200} className={`${inputClass} h-11`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {t("block")}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
