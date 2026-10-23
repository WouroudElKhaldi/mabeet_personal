"use client";

import type { PaymentMethod } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, TextArea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { PLAN_PAYMENT_METHODS } from "@/config/enums";

/** Approve a host's plan request (the plan starts at once) or reject it, with a note they see. */
export function PlanRequestDecision({ requestId }: { requestId: string }) {
  const t = useTranslations("adminBilling");
  const { run, pending, error } = useAction();
  const note = useRef<HTMLInputElement>(null);
  const decide = (action: "approve" | "reject") =>
    run(() =>
      api.post(`/api/admin/plan-requests/${requestId}`, {
        action,
        note: note.current?.value.trim() || null,
      }),
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={note} placeholder={t("note")} maxLength={500} className={`${inputClass} h-9 w-56`} />
      <Button size="sm" disabled={pending} onClick={() => decide("approve")}>
        {t("approve")}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("reject")}>
        {t("reject")}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface Option {
  id: string;
  method: PaymentMethod;
  label: string;
  details: string;
  active: boolean;
  position: number;
}

function OptionForm({ option, onDone }: { option?: Option; onDone?: () => void }) {
  const t = useTranslations("adminBilling");
  const tMethods = useTranslations("manualPlan.methods");
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const body = {
          method: String(data.get("method")),
          label: String(data.get("label")),
          details: String(data.get("details")),
          active: data.get("active") === "on",
          position: Number(data.get("position") || 0),
        };
        run(
          () =>
            option
              ? api.patch(`/api/admin/payment-options/${option.id}`, body)
              : api.post("/api/admin/payment-options", body),
          () => {
            if (!option) form.reset();
            onDone?.();
          },
        );
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="grid gap-1.5 text-sm font-semibold">
        {t("method")}
        <select name="method" defaultValue={option?.method ?? "BANK_TRANSFER"} className={inputClass}>
          {PLAN_PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {tMethods(method)}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={t("label")}
        name="label"
        required
        minLength={2}
        maxLength={80}
        defaultValue={option?.label}
        placeholder={t("labelPlaceholder")}
      />
      <TextArea
        label={t("details")}
        name="details"
        required
        minLength={3}
        maxLength={1000}
        rows={4}
        defaultValue={option?.details}
        placeholder={t("detailsPlaceholder")}
        className="sm:col-span-2"
      />
      <Field
        label={t("position")}
        name="position"
        type="number"
        min={0}
        max={999}
        defaultValue={option?.position ?? 0}
      />
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={option?.active ?? true} />
        {t("active")}
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {option ? t("save") : t("add")}
      </Button>
    </form>
  );
}

/** Where hosts can send plan payments: the super admin's bank accounts, numbers and wallets. */
export function PaymentOptionsEditor({ options }: { options: Option[] }) {
  const t = useTranslations("adminBilling");
  const tMethods = useTranslations("manualPlan.methods");
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      {options.length === 0 && <p className="text-sm text-muted">{t("noOptions")}</p>}
      <ul className="grid gap-3">
        {options.map((option) => (
          <li key={option.id} className="rounded-lg p-4 ring-1 ring-line">
            {editing === option.id ? (
              <OptionForm option={option} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {option.label}{" "}
                    <span className="ms-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                      {tMethods(option.method)}
                    </span>
                    {!option.active && (
                      <span className="ms-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                        {t("hidden")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm break-words whitespace-pre-line text-muted">{option.details}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(option.id)}>
                    {t("edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => api.delete(`/api/admin/payment-options/${option.id}`))}
                  >
                    {t("remove")}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="rounded-lg bg-surface-2/60 p-4">
        <h3 className="mb-3 font-semibold">{t("addTitle")}</h3>
        <OptionForm />
      </div>
    </div>
  );
}
