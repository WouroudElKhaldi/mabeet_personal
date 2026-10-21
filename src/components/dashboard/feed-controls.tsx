"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

const SOURCES = ["AIRBNB", "BOOKING", "KAZDERNI", "OTHER"] as const;

export function FeedButtons({ businessId, feedId }: { businessId: string; feedId: string }) {
  const t = useTranslations("dashboard.channels");
  const { run, pending, error } = useAction();
  const base = `/api/workspaces/${businessId}/feeds/${feedId}`;
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => api.post(`${base}/sync`, {}))}
      >
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
        {t("syncNow")}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={t("remove")}
        onClick={() => run(() => api.delete(base))}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function AddFeedForm({ businessId, roomId }: { businessId: string; roomId: string }) {
  const t = useTranslations("dashboard.channels");
  const { run, pending, error } = useAction();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        api.post(`/api/workspaces/${businessId}/feeds`, {
          roomId,
          url: data.get("url"),
          source: data.get("source"),
        }),
      () => form.reset(),
    );
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
      <select name="source" aria-label={t("source")} className={`${inputClass} h-11`}>
        {SOURCES.map((source) => (
          <option key={source} value={source}>
            {t(`sources.${source}`)}
          </option>
        ))}
      </select>
      <input
        name="url"
        type="url"
        required
        placeholder="https://www.airbnb.com/calendar/ical/…"
        aria-label={t("url")}
        className={`${inputClass} h-11`}
      />
      <Button type="submit" size="sm" className="h-11" disabled={pending}>
        {t("add")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  );
}
