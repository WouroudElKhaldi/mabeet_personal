"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { FEED_SOURCES } from "@/config/enums";
import { useTranslations } from "next-intl";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

export function FeedButtons({ businessId, feedId }: { businessId: string; feedId: string }) {
  const t = useTranslations("dashboard.channels");
  const { run, pending, error } = useAction();
  const base = `/api/workspaces/${businessId}/feeds/${feedId}`;
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  /** Runs `action` only after the person confirms. */
  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };
  return (
    <div className="flex items-center gap-1">
      {confirmDialog}
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
        onClick={() =>
          void confirmThen(
            {
              title: tConfirm("removeFeed.title"),
              body: tConfirm("removeFeed.body"),
              confirmLabel: tConfirm("removeFeed.confirm"),
              danger: true,
            },
            () => api.delete(base),
          )
        }
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
        {FEED_SOURCES.map((source) => (
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
