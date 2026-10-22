import { getLocale, getTranslations } from "next-intl/server";
import { ManageBillingButton, UpgradeButton } from "@/components/billing/billing-buttons";
import { PlanCards } from "@/components/billing/plan-cards";
import { PLANS, type PlanName } from "@/config/plans";
import { formatDate } from "@/lib/format";
import { requirePageAccess } from "@/server/http/session";
import { getBilling } from "@/server/services/billing-service";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

/** The business's plan, what it uses against the limits, and the way to upgrade or manage billing. */
export default async function BillingPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const { checkout } = await searchParams;
  const ctx = await requirePageAccess(businessId, ["settings.manage"]);
  const [t, locale, billing] = await Promise.all([getTranslations("plans"), getLocale(), getBilling(ctx)]);
  const usage = [
    { label: t("usage.rooms"), used: billing.usage.rooms, max: billing.limits.rooms },
    { label: t("usage.offerings"), used: billing.usage.offerings, max: billing.limits.offerings },
    { label: t("usage.members"), used: billing.usage.members, max: billing.limits.members },
  ];
  const higher = (plan: PlanName) => PLANS.indexOf(plan) > PLANS.indexOf(billing.plan);

  return (
    <div className="grid gap-8">
      <header className="rise-in">
        <h1 className="text-4xl font-semibold">{t("billingTitle")}</h1>
        <p className="mt-2 text-muted">
          {t("currentPlan", { plan: t(`names.${billing.plan}`) })}
          {billing.renewsAt && ` · ${t("renews", { date: formatDate(billing.renewsAt, locale) })}`}
        </p>
      </header>

      {checkout === "done" && (
        <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm font-semibold">
          {t("thanks")}
        </p>
      )}
      {!billing.checkoutEnabled && (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("notConfigured")}</p>
      )}
      {!billing.canManage && <p className="text-sm text-muted">{t("ownersOnly")}</p>}

      <section className="grid gap-3 sm:grid-cols-3">
        {usage.map((row) => (
          <div key={row.label} className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <p className="text-sm text-muted">{row.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {row.used}
              <span className="text-base font-normal text-muted"> / {row.max ?? "∞"}</span>
            </p>
          </div>
        ))}
      </section>

      {billing.hasSubscription && billing.canManage && <ManageBillingButton businessId={businessId} />}

      <PlanCards
        current={billing.plan}
        action={(plan) =>
          plan !== "FREE" && higher(plan) && !billing.hasSubscription ? (
            <UpgradeButton
              businessId={businessId}
              plan={plan}
              disabled={!billing.checkoutEnabled || !billing.canManage}
            />
          ) : null
        }
      />
    </div>
  );
}
