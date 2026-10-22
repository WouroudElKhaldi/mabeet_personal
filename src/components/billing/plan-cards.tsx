import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PLAN_LIMITS, PLANS, type PlanName } from "@/config/plans";
import { formatMoney } from "@/lib/format";

/** The three host plans side by side. `action` renders each card's button; `current` marks the plan in use. */
export async function PlanCards({
  current,
  action,
}: {
  current?: PlanName;
  action: (plan: PlanName) => ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("plans"), getLocale()]);
  const limit = (value: number | null) => (value === null ? t("unlimited") : String(value));

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PLANS.map((plan) => {
        const limits = PLAN_LIMITS[plan];
        const features: Array<{ text: string; included: boolean }> = [
          { text: t("rooms", { count: limit(limits.rooms) }), included: true },
          { text: t("offerings", { count: limit(limits.offerings) }), included: true },
          { text: t("members", { count: limit(limits.members) }), included: true },
          { text: t("basics"), included: true },
          { text: t("ai"), included: limits.ai },
        ];
        return (
          <li
            key={plan}
            className={clsx(
              "flex flex-col rounded-2xl bg-surface p-6",
              plan === "PRO" ? "shadow-lift ring-2 ring-accent" : "ring-1 ring-line",
            )}
          >
            <p className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{t(`names.${plan}`)}</span>
              {current === plan ? (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
                  {t("current")}
                </span>
              ) : (
                plan === "PRO" && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
                    {t("popular")}
                  </span>
                )
              )}
            </p>
            <p className="mt-1 text-sm text-muted">{t(`blurbs.${plan}`)}</p>
            <p className="mt-5">
              <span className="font-poster text-4xl">
                {formatMoney(limits.monthlyUsd * 100, "USD", locale)}
              </span>
              <span className="text-sm text-muted"> {t("perMonth")}</span>
            </p>
            <ul className="mt-5 grid flex-1 content-start gap-2.5 text-sm">
              {features.map((feature) => (
                <li key={feature.text} className={clsx("flex gap-2", !feature.included && "text-faint")}>
                  {feature.included ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <span>
                    {!feature.included && <span className="sr-only">{t("notIncluded")} </span>}
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6">{action(plan)}</div>
          </li>
        );
      })}
    </ul>
  );
}
