"use client";

import { CreditCard, LoaderCircle, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { OnlineMethod } from "@/config/enums";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

/** Sends the guest to Whish or Stripe to pay what the booking needs. Mabeet holds it for the host. */
export function PayOnline({ token, methods }: { token: string; methods: OnlineMethod[] }) {
  const t = useTranslations("confirmation.pay");
  const tCommon = useTranslations("common");
  const { go, pending, error } = useRedirectAction(tCommon("error"));
  const [chosen, setChosen] = useState<OnlineMethod | null>(null);

  const pay = (method: OnlineMethod) => {
    setChosen(method);
    go(
      async () => (await api.post<{ url: string }>(`/api/public/bookings/${token}/checkout`, { method })).url,
    );
  };

  if (methods.length === 0) return <p className="mt-3 text-sm text-muted">{t("unavailable")}</p>;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        {methods.map((method) => (
          <Button
            key={method}
            size="lg"
            variant={method === "WHISH" ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => pay(method)}
          >
            {pending && chosen === method ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            ) : method === "WHISH" ? (
              <Wallet className="size-5" aria-hidden />
            ) : (
              <CreditCard className="size-5" aria-hidden />
            )}
            {t(method === "WHISH" ? "whish" : "card")}
          </Button>
        ))}
      </div>
      <FormError message={error} className="mt-3" />
    </div>
  );
}
