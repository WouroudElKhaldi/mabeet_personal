import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlanCards } from "@/components/billing/plan-cards";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plans");
  return { title: t("title"), description: t("subtitle") };
}

/** Public plans for hosts. Paying happens from the dashboard, where the business is known. */
export default async function PricingPage() {
  const t = await getTranslations("plans");
  return (
    <div className="mx-auto max-w-280 px-4 pt-12 pb-8 sm:px-6 lg:px-10">
      <header className="rise-in mx-auto mb-10 max-w-2xl text-center">
        <h1 className="font-poster text-[clamp(2rem,4vw,3rem)]">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted">{t("subtitle")}</p>
      </header>
      <PlanCards
        action={(plan) => (
          <ButtonLink href="/host" variant={plan === "PRO" ? "primary" : "secondary"} className="w-full">
            {plan === "FREE" ? t("startFree") : t("startWith", { plan: t(`names.${plan}`) })}
          </ButtonLink>
        )}
      />
      <p className="mt-8 text-center text-sm text-muted">{t("noCommission")}</p>
    </div>
  );
}
