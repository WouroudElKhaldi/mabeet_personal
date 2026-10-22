"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api-client";

/** Asks the server for a Stripe page (Checkout or the billing portal) and goes there. */
function useStripeRedirect() {
  const t = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const go = (path: string, body: unknown) =>
    startTransition(async () => {
      setError(null);
      try {
        const { url } = await api.post<{ url: string }>(path, body);
        window.location.assign(url);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : t("error"));
      }
    });
  return { go, pending, error };
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-sm font-semibold text-danger">
      {error}
    </p>
  );
}

export function UpgradeButton({
  businessId,
  plan,
  disabled,
}: {
  businessId: string;
  plan: "PRO" | "BUSINESS";
  disabled: boolean;
}) {
  const t = useTranslations("plans");
  const { go, pending, error } = useStripeRedirect();
  return (
    <>
      <Button
        className="w-full"
        disabled={disabled || pending}
        onClick={() => go(`/api/workspaces/${businessId}/billing/checkout`, { plan })}
      >
        {t("choose", { plan: t(`names.${plan}`) })}
      </Button>
      <ErrorLine error={error} />
    </>
  );
}

export function ManageBillingButton({ businessId }: { businessId: string }) {
  const t = useTranslations("plans");
  const { go, pending, error } = useStripeRedirect();
  return (
    <div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => go(`/api/workspaces/${businessId}/billing/portal`, {})}
      >
        {t("manage")}
      </Button>
      <ErrorLine error={error} />
    </div>
  );
}
