"use client";

import { CreditCard, LoaderCircle, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api-client";

/** Sends the guest to Whish or Stripe to pay what the booking needs. Mabeet holds it for the host. */
export function PayOnline({ token, methods }: { token: string; methods: Array<"WHISH" | "CARD"> }) {
  const t = useTranslations("confirmation.pay");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  const pay = (method: "WHISH" | "CARD") =>
    startTransition(async () => {
      setError(null);
      setChosen(method);
      try {
        const { url } = await api.post<{ url: string }>(`/api/public/bookings/${token}/checkout`, { method });
        window.location.assign(url);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : tCommon("error"));
      }
    });

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
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
