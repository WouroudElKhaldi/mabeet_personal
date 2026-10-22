"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** The admin sent a payout (with the transfer's reference) or refuses it. */
export function PayoutDecision({ payoutId }: { payoutId: string }) {
  const t = useTranslations("admin.money");
  const { run, pending, error } = useAction();
  const reference = useRef<HTMLInputElement>(null);
  const decide = (action: "paid" | "rejected") =>
    run(() =>
      api.post(`/api/admin/payouts/${payoutId}`, {
        action,
        reference: reference.current?.value.trim() || null,
      }),
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={reference}
        placeholder={t("reference")}
        maxLength={120}
        className={`${inputClass} h-9 w-44`}
      />
      <Button size="sm" disabled={pending} onClick={() => decide("paid")}>
        {t("markPaid")}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("rejected")}>
        {t("reject")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** The admin sent a refund by hand. */
export function RefundSent({ refundId }: { refundId: string }) {
  const t = useTranslations("admin.money");
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() =>
          api.post(`/api/admin/refunds/${refundId}`, {
            reference: String(data.get("reference") ?? "").trim() || null,
          }),
        );
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="reference"
        placeholder={t("reference")}
        maxLength={120}
        className={`${inputClass} h-9 w-44`}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {t("markSent")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
