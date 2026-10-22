import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { requirePageUser } from "@/server/http/session";
import { getAiUsage, getSyncHealth } from "@/server/services/admin-service";

/** Things that run on their own: calendar sync with the platforms, and AI spending against the budget. */
export default async function AdminHealthPage() {
  const user = await requirePageUser();
  const [t, locale, ai, sync] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    getAiUsage(user),
    getSyncHealth(user),
  ]);
  const usd = (micro: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
      micro / 1_000_000,
    );
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PageHeader title={t("nav.health")} intro={t("healthIntro")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={t("sync.title")}
          intro={t("sync.summary", { total: sync.total, problems: sync.unhealthy.length })}
        >
          {sync.unhealthy.length === 0 ? (
            <p className="text-sm text-faint">{t("sync.allGood")}</p>
          ) : (
            <ul className="grid gap-2">
              {sync.unhealthy.map((feed) => (
                <li key={feed.id} className="rounded-lg bg-paper p-4 text-sm ring-1 ring-line">
                  <p className="font-semibold">
                    {feed.business.name} · {feed.room.name}{" "}
                    <span className="font-normal text-muted">({feed.source})</span>
                  </p>
                  <p className="mt-1 text-muted">
                    {feed.lastSyncedAt
                      ? t("sync.lastSynced", { when: when.format(feed.lastSyncedAt) })
                      : t("sync.never")}
                  </p>
                  {feed.lastError && <p className="mt-1 text-danger">{feed.lastError}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={t("ai.title")}
          intro={t("ai.ofBudget", { spent: usd(ai.costMicroUsd), budget: usd(ai.budgetMicroUsd) })}
        >
          <div
            className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2"
            role="meter"
            aria-label={t("ai.title")}
            aria-valuemin={0}
            aria-valuemax={ai.budgetMicroUsd}
            aria-valuenow={ai.costMicroUsd}
          >
            <div
              className={clsx(
                "h-full rounded-full",
                ai.costMicroUsd >= ai.budgetMicroUsd * 0.8 ? "bg-danger" : "bg-accent",
              )}
              style={{ width: `${Math.min(100, (ai.costMicroUsd / ai.budgetMicroUsd) * 100)}%` }}
            />
          </div>
          {ai.surfaces.length === 0 ? (
            <p className="text-sm text-faint">{t("ai.none")}</p>
          ) : (
            <ul className="grid gap-2">
              {ai.surfaces.map((row) => (
                <li
                  key={row.surface}
                  className="flex items-center justify-between gap-3 rounded-lg bg-paper p-4 text-sm ring-1 ring-line"
                >
                  <span className="font-semibold">
                    {t(`ai.surfaces.${row.surface === "team" ? "team" : "concierge"}`)}
                  </span>
                  <span className="text-muted tabular-nums">
                    {t("ai.row", { answers: row.answers, tokens: row.tokens })} · {usd(row.costMicroUsd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
