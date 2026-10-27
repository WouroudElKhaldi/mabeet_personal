"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { PaidPlan } from "@/config/plans";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

/** Asks the server for a payment page (Stripe Checkout, the billing portal or Whish) and goes there. */
function usePaymentRedirect() {
  const t = useTranslations("common");
  const { go, pending, error } = useRedirectAction(t("error"));
  const goTo = (path: string, body: unknown) =>
    go(async () => (await api.post<{ url: string }>(path, body)).url);
  return { go: goTo, pending, error };
}

export function UpgradeButton({
  businessId,
  plan,
  disabled,
}: {
  businessId: string;
  plan: PaidPlan;
  disabled: boolean;
}) {
  const t = useTranslations("plans");
  const { go, pending, error } = usePaymentRedirect();
  return (
    <>
      <Button
        className="w-full"
        disabled={disabled || pending}
        onClick={() => go(`/api/workspaces/${businessId}/billing/checkout`, { plan })}
      >
        {t("choose", { plan: t(`names.${plan}`) })}
      </Button>
      <FormError message={error} className="mt-2" />
    </>
  );
}

export function ManageBillingButton({ businessId }: { businessId: string }) {
  const t = useTranslations("plans");
  const { go, pending, error } = usePaymentRedirect();
  return (
    <div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => go(`/api/workspaces/${businessId}/billing/portal`, {})}
      >
        {t("manage")}
      </Button>
      <FormError message={error} className="mt-2" />
    </div>
  );
}

/** Pays one month of a plan with Whish, for hosts without a card. Each payment adds a month. */
export function WhishPlanButton({ businessId, plan }: { businessId: string; plan: PaidPlan }) {
  const t = useTranslations("plans");
  const { go, pending, error } = usePaymentRedirect();
  return (
    <>
      <Button
        variant="secondary"
        className="mt-2 w-full"
        disabled={pending}
        onClick={() => go(`/api/workspaces/${businessId}/billing/whish`, { plan })}
      >
        {t("payWhish")}
      </Button>
      <FormError message={error} className="mt-2" />
    </>
  );
}
