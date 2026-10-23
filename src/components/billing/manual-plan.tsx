"use client";

import type { PaymentMethod } from "@prisma/client";
import { clsx } from "clsx";
import { FileCheck2, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { Field, inputClass, TextArea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE } from "./plan-request-status";

export interface PaymentOptionView {
  id: string;
  method: PaymentMethod;
  label: string;
  details: string;
}

export interface PlanRequestView {
  id: string;
  plan: "FREE" | "PRO" | "BUSINESS";
  months: number;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  payerReference: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionNote: string | null;
  createdAt: Date;
}

const MONTHS = [1, 3, 6, 12];

/**
 * Paying for a plan by hand: send the price to one of the ways Mabeet lists (bank, Whish, OMT, crypto, cash),
 * then send the receipt. The plan starts when a Mabeet admin checks it. One request waits at a time.
 */
export function ManualPlanRequest({
  businessId,
  options,
  requests,
  monthlyUsd,
}: {
  businessId: string;
  options: PaymentOptionView[];
  requests: PlanRequestView[];
  monthlyUsd: { PRO: number; BUSINESS: number };
}) {
  const t = useTranslations("manualPlan");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const [plan, setPlan] = useState<"PRO" | "BUSINESS">("PRO");
  const [months, setMonths] = useState(1);
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [sent, setSent] = useState(false);
  const waiting = requests.find((request) => request.status === "PENDING");
  const usd = (cents: number) => formatMoney(cents, "USD", locale);
  const total = monthlyUsd[plan] * months * 100;

  return (
    <section
      className="grid gap-5 rounded-xl bg-surface p-5 ring-1 ring-line sm:p-6"
      aria-labelledby="manual-plan"
    >
      <div>
        <h2 id="manual-plan" className="text-2xl font-semibold">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      {waiting ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="size-5 text-accent" aria-hidden />
            {t("waiting", {
              plan: tPlans(`names.${waiting.plan}`),
              months: waiting.months,
              amount: usd(waiting.amountCents),
            })}
          </p>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() => api.delete(`/api/workspaces/${businessId}/billing/requests/${waiting.id}`))
            }
          >
            {t("cancel")}
          </Button>
        </div>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted">{t("noOptions")}</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            form.set("plan", plan);
            form.set("months", String(months));
            form.set("optionId", optionId);
            run(
              () => api.upload(`/api/workspaces/${businessId}/billing/requests`, form),
              () => setSent(true),
            );
          }}
          className="grid gap-5"
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("step1")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label={t("plan")}
                value={plan}
                onChange={(event) => setPlan(event.target.value as "PRO" | "BUSINESS")}
                className={inputClass}
              >
                {(["PRO", "BUSINESS"] as const).map((name) => (
                  <option key={name} value={name}>
                    {tPlans(`names.${name}`)} · {usd(monthlyUsd[name] * 100)} {tPlans("perMonth")}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("months")}
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
                className={inputClass}
              >
                {MONTHS.map((count) => (
                  <option key={count} value={count}>
                    {t("monthsOption", { count })}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm">
              {t("total")} <span className="font-semibold tabular-nums">{usd(total)}</span>
            </p>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("step2")}</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={clsx(
                    "grid min-w-0 cursor-pointer gap-2 rounded-lg p-4 ring-1 transition-shadow",
                    option.id === optionId ? "ring-2 ring-ink" : "ring-line-strong hover:ring-ink/50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="option"
                      value={option.id}
                      checked={option.id === optionId}
                      onChange={() => setOptionId(option.id)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="font-semibold">{option.label}</span>
                    <span className="ms-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                      {t(`methods.${option.method}`)}
                    </span>
                  </span>
                  <span className="text-sm break-words whitespace-pre-line text-muted">{option.details}</span>
                  {option.id === optionId && option.details.split("\n").length === 1 && (
                    <CopyField value={option.details} label={option.label} />
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="mb-2 text-sm font-semibold">{t("step3")}</legend>
            <div className="grid gap-1.5">
              <label htmlFor="receipt" className="text-sm font-semibold">
                {t("receipt")}
              </label>
              <input
                id="receipt"
                name="receipt"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="text-sm file:me-3 file:h-10 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:font-semibold"
              />
              <p className="text-xs text-muted">{t("receiptHint")}</p>
            </div>
            <Field label={t("reference")} name="payerReference" maxLength={120} hint={t("referenceHint")} />
            <TextArea label={t("note")} name="note" maxLength={500} rows={2} />
          </fieldset>

          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending || !optionId} className="w-full sm:w-fit">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {t("send")}
          </Button>
        </form>
      )}
      {sent && waiting && (
        <p role="status" className="text-sm font-semibold text-success">
          {t("sent")}
        </p>
      )}

      {requests.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("history")}</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="text-muted tabular-nums">{formatDate(request.createdAt, locale)}</span>
                <span className="font-semibold">
                  {t("planMonths", { plan: tPlans(`names.${request.plan}`), count: request.months })}
                </span>
                <span className="tabular-nums">{usd(request.amountCents)}</span>
                <span className="text-muted">{t(`methods.${request.method}`)}</span>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    STATUS_TONE[request.status],
                  )}
                >
                  {t(`status.${request.status}`)}
                </span>
                <a
                  href={`/api/workspaces/${businessId}/billing/requests/${request.id}/receipt`}
                  target="_blank"
                  rel="noopener"
                  className="ms-auto font-semibold underline underline-offset-4"
                >
                  {t("viewReceipt")}
                </a>
                {request.decisionNote && (
                  <p className="basis-full text-muted">{t("adminNote", { note: request.decisionNote })}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
