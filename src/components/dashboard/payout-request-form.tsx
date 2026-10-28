"use client";

import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, panelClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";

interface PayoutDetails {
  method: "BANK_TRANSFER" | "WHISH";
  accountName: string;
  bankName: string | null;
  iban: string | null;
  whishPhone: string | null;
}

interface PayoutRequestFormProps {
  businessId: string;
  balances: Array<{ currency: string; availableCents: number }>;
  /** The details used last time, so the next request is quicker. */
  last: PayoutDetails | null;
}

/** Asks Mabeet to send the available money to a bank account (IBAN) or a Whish number. Never card numbers. */
export function PayoutRequestForm({ businessId, balances, last }: PayoutRequestFormProps) {
  const t = useTranslations("dashboard.payouts");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const payable = balances.filter((balance) => balance.availableCents >= 100);
  const [currency, setCurrency] = useState(payable[0]?.currency ?? "");
  const [method, setMethod] = useState<PayoutDetails["method"]>(last?.method ?? "WHISH");
  const [sent, setSent] = useState(false);
  const available = payable.find((balance) => balance.currency === currency)?.availableCents ?? 0;

  if (payable.length === 0) {
    return <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("nothingAvailable")}</p>;
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim() || null;
    setSent(false);
    run(
      () =>
        api.post(`/api/workspaces/${businessId}/payouts`, {
          amountCents: Math.round(Number(data.get("amount")) * 100),
          currency,
          method,
          accountName: text("accountName"),
          bankName: method === "BANK_TRANSFER" ? text("bankName") : null,
          iban: method === "BANK_TRANSFER" ? text("iban") : null,
          whishPhone: method === "WHISH" ? text("whishPhone")?.replace(/[\s-]/g, "") : null,
        }),
      () => setSent(true),
    );
  };

  return (
    <form onSubmit={submit} className={clsx(panelClass, "grid gap-4 sm:grid-cols-2")}>
      <h2 className="font-display text-xl font-semibold sm:col-span-2">{t("requestTitle")}</h2>
      <label className="grid gap-1 text-sm font-semibold">
        {t("currency")}
        <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
          {payable.map((balance) => (
            <option key={balance.currency} value={balance.currency}>
              {balance.currency} · {formatMoney(balance.availableCents, balance.currency, locale)}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={t("amount")}
        name="amount"
        type="number"
        min="1"
        step="0.01"
        max={(available / 100).toFixed(2)}
        defaultValue={(available / 100).toFixed(2)}
        required
      />
      <label className="grid gap-1 text-sm font-semibold">
        {t("method")}
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as PayoutDetails["method"])}
          className={inputClass}
        >
          <option value="WHISH">{t("methods.WHISH")}</option>
          <option value="BANK_TRANSFER">{t("methods.BANK_TRANSFER")}</option>
        </select>
      </label>
      <Field label={t("accountName")} name="accountName" defaultValue={last?.accountName} required />
      {method === "WHISH" ? (
        <Field
          label={t("whishPhone")}
          name="whishPhone"
          type="tel"
          placeholder="+96170123456"
          defaultValue={last?.whishPhone ?? ""}
          required
        />
      ) : (
        <>
          <Field label={t("bankName")} name="bankName" defaultValue={last?.bankName ?? ""} required />
          <Field
            label={t("iban")}
            name="iban"
            placeholder="LB62 0999 0000 0001 0019 0122 9114"
            defaultValue={last?.iban ?? ""}
            hint={t("ibanHint")}
            required
          />
        </>
      )}
      <p className="text-xs text-muted sm:col-span-2">{t("noCards")}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("request")}
        </Button>
        {sent && !error && (
          <p role="status" className="text-sm font-semibold text-success">
            {t("requested")}
          </p>
        )}
        <FormError message={error} />
      </div>
    </form>
  );
}
