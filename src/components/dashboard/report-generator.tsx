"use client";

import { clsx } from "clsx";
import { LoaderCircle, Printer, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { RichText } from "@/components/assistant/rich-text";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { Analytics } from "@/server/services/analytics-service";
import type { AiReport } from "@/server/services/report-service";
import { ChannelsChart, NightsChart, RequestsChart, RevenueChart } from "./analytics-charts";

const TOPICS = ["occupancy", "revenue", "channels", "requests", "reviews", "places"] as const;

/**
 * "Generate a report": the host picks what to cover, the period and the places; DeepSeek writes the analysis
 * of the database's numbers, and the charts beside each section are drawn from those same numbers.
 */
export function ReportGenerator({
  businessId,
  from,
  to,
  scope,
}: {
  businessId: string;
  from: string;
  to: string;
  scope: "place" | "all";
}) {
  const t = useTranslations("analytics");
  const tReport = useTranslations("analytics.report");
  const tChannel = useTranslations("dashboard.overview.channel");
  const tStatus = useTranslations("dashboard.bookings.status");
  const locale = useLocale();
  const [topics, setTopics] = useState<string[]>(["occupancy", "revenue", "channels"]);
  const [period, setPeriod] = useState({ from, to, scope });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ report: AiReport; data: Analytics } | null>(null);

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      setResult(await api.post(`/api/workspaces/${businessId}/analytics/report`, { ...period, topics }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("error"));
    } finally {
      setPending(false);
    }
  };

  const data = result?.data;
  const month = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const labels = {
    month: (iso: string) => month.format(new Date(`${iso}-01T00:00:00Z`)),
    money: (cents: number) => formatMoney(cents, data?.totals.revenueCurrency ?? "USD", locale),
    nights: (count: number) => t("nights", { count }),
    channel: (key: string) => tChannel(key as "DIRECT"),
    status: (key: string) => tStatus(key as "HELD"),
  };
  const chartFor = (topic: string) => {
    if (!data) return null;
    if (topic === "occupancy") return <NightsChart rows={data.totals.nightsByMonth} labels={labels} />;
    if (topic === "revenue") return <RevenueChart rows={data.totals.revenueByMonth} labels={labels} />;
    if (topic === "channels") return <ChannelsChart rows={data.totals.channels} labels={labels} />;
    if (topic === "requests") return <RequestsChart counts={data.totals.requests} labels={labels} />;
    return null;
  };

  return (
    <section className="mt-10 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6 print:ring-0">
      <div className="print:hidden">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="size-5 text-glow" aria-hidden />
          {tReport("title")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{tReport("intro")}</p>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-semibold">{tReport("cover")}</legend>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <label
                key={topic}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={topics.includes(topic)}
                  onChange={(event) =>
                    setTopics((current) =>
                      event.target.checked ? [...current, topic] : current.filter((item) => item !== topic),
                    )
                  }
                />
                {tReport(`topics.${topic}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold">
            {t("from")}
            <input
              type="date"
              value={period.from}
              onChange={(event) => setPeriod({ ...period, from: event.target.value })}
              className={clsx(inputClass, "h-10")}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            {t("to")}
            <input
              type="date"
              value={period.to}
              onChange={(event) => setPeriod({ ...period, to: event.target.value })}
              className={clsx(inputClass, "h-10")}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            {t("scope")}
            <select
              value={period.scope}
              onChange={(event) => setPeriod({ ...period, scope: event.target.value as "place" | "all" })}
              className={clsx(inputClass, "h-10")}
            >
              <option value="place">{t("scopes.place")}</option>
              <option value="all">{t("scopes.all")}</option>
            </select>
          </label>
          <Button disabled={pending || topics.length === 0} onClick={() => void generate()}>
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {pending ? tReport("writing") : tReport("generate")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      {result && (
        <article className="mt-8 grid gap-6 border-t border-line pt-6 print:mt-0 print:border-0 print:pt-0">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">
                {result.data.range.from} → {result.data.range.to} ·{" "}
                {result.data.places.map((place) => place.name).join(", ")}
              </p>
              <h3 className="mt-1 text-2xl font-semibold">{result.report.title}</h3>
            </div>
            <Button size="sm" variant="secondary" className="print:hidden" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {tReport("print")}
            </Button>
          </header>
          <div className="leading-relaxed">
            <RichText text={result.report.summary} />
          </div>
          {result.report.highlights.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.report.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-xl bg-accent-soft p-4 text-sm font-semibold ring-1 ring-accent-line"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          )}
          {result.report.sections.map((section) => {
            const chart = chartFor(section.topic);
            return (
              <section
                key={`${section.topic}-${section.title}`}
                className={clsx("grid gap-4", chart && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]")}
              >
                <div>
                  <h4 className="text-lg font-semibold">{section.title}</h4>
                  <div className="mt-2 leading-relaxed whitespace-pre-line text-ink/90">
                    <RichText text={section.body} />
                  </div>
                </div>
                {chart && <div className="rounded-xl bg-paper p-4 ring-1 ring-line">{chart}</div>}
              </section>
            );
          })}
          {result.report.recommendations.length > 0 && (
            <section>
              <h4 className="text-lg font-semibold">{tReport("recommendations")}</h4>
              <ol className="mt-2 grid list-decimal gap-2 ps-5">
                {result.report.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
          )}
          <p className="text-xs text-muted">{tReport("disclaimer")}</p>
        </article>
      )}
    </section>
  );
}
