import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { CopyField } from "@/components/dashboard/copy-field";
import { AddFeedForm, FeedButtons } from "@/components/dashboard/feed-controls";
import { env } from "@/server/env";
import { requirePageTenant } from "@/server/http/session";
import { getChannelSetup } from "@/server/services/calendar-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function ChannelsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const [t, locale, rooms] = await Promise.all([
    getTranslations("dashboard.channels"),
    getLocale(),
    getChannelSetup(ctx),
  ]);
  const synced = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="grid gap-8">
      <header className="rise-in">
        <h1 className="text-4xl font-medium">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </header>
      {rooms.map((room) => (
        <section key={room.id} className="grid gap-5 rounded-xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-xl font-semibold">{room.name}</h2>
          <div className="grid gap-2">
            <p className="text-sm font-semibold">{t("exportTitle")}</p>
            <p className="text-sm text-muted">{t("exportHint")}</p>
            <CopyField
              value={`${env.BETTER_AUTH_URL}/api/ical/${room.exportToken}.ics`}
              label={t("exportTitle")}
            />
          </div>
          <div className="grid gap-3">
            <p className="text-sm font-semibold">{t("importTitle")}</p>
            <ul className="grid gap-2">
              {room.feeds.map((feed) => (
                <li
                  key={feed.id}
                  className="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-4 py-3"
                >
                  {feed.lastError ? (
                    <AlertTriangle className="size-4 text-danger" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t(`sources.${feed.source}`)}</p>
                    <p className="truncate text-xs text-muted">
                      {feed.lastError
                        ? feed.lastError
                        : feed.lastSyncedAt
                          ? t("lastSynced", { when: synced.format(feed.lastSyncedAt) })
                          : t("neverSynced")}
                    </p>
                  </div>
                  <FeedButtons businessId={businessId} feedId={feed.id} />
                </li>
              ))}
            </ul>
            <AddFeedForm businessId={businessId} roomId={room.id} />
          </div>
        </section>
      ))}
    </div>
  );
}
