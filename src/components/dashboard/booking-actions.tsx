"use client";

import type { BookingStatus } from "@prisma/client";
import { MANUAL_PAYMENT_METHODS } from "@/config/enums";
import { Check, HandCoins, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

interface BookingActionsProps {
  businessId: string;
  bookingId: string;
  status: BookingStatus;
  depositCents: number;
  canDecide: boolean;
  canRecordPayment: boolean;
  /** Room stays and experience/service sessions have separate endpoints. */
  kind?: "stay" | "session";
}

export function BookingActions({
  businessId,
  bookingId,
  status,
  depositCents,
  canDecide,
  canRecordPayment,
  kind = "stay",
}: BookingActionsProps) {
  const t = useTranslations("dashboard.bookings");
  const { run, pending, error } = useAction();
  const [recording, setRecording] = useState(false);
  const base = `/api/workspaces/${businessId}/${kind === "session" ? "session-bookings" : "bookings"}/${bookingId}`;
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  const decide = async (action: "confirm" | "decline" | "cancel") => {
    if (action === "confirm") return run(() => api.post(`${base}/confirm`, {}));
    const answer = await ask({
      title: tConfirm(`${action}.title`),
      body: tConfirm(`${action}.body`),
      confirmLabel: tConfirm(`${action}.confirm`),
      danger: true,
      reason: { label: tConfirm("reasonOptional") },
    });
    if (answer.confirmed)
      run(() => api.post(`${base}/${action}`, answer.reason ? { reason: answer.reason } : {}));
  };

  const record = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(
      () =>
        api.post(`${base}/payments`, {
          amountCents: Math.round(Number(form.get("amount")) * 100),
          method: form.get("method"),
        }),
      () => setRecording(false),
    );
  };

  return (
    <div className="grid gap-3">
      {confirmDialog}
      <div className="flex flex-wrap gap-2">
        {canDecide && status === "HELD" && (
          <>
            <Button size="sm" disabled={pending} onClick={() => decide("confirm")}>
              <Check className="size-4" aria-hidden />
              {t("confirm")}
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("decline")}>
              <X className="size-4" aria-hidden />
              {t("decline")}
            </Button>
          </>
        )}
        {canRecordPayment && (status === "HELD" || status === "CONFIRMED") && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRecording((open) => !open)}>
            <HandCoins className="size-4" aria-hidden />
            {t("recordDeposit")}
          </Button>
        )}
        {canDecide && status === "CONFIRMED" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("cancel")}>
            {t("cancel")}
          </Button>
        )}
      </div>
      <AnimatePresence>
        {recording && (
          <motion.form
            onSubmit={record}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap items-end gap-2 overflow-hidden"
          >
            <label className="grid gap-1 text-xs font-semibold text-muted">
              {t("amount")}
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={(depositCents / 100).toFixed(2)}
                className={`${inputClass} h-10 w-28`}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              {t("method")}
              <select name="method" className={`${inputClass} h-10 w-40`}>
                {MANUAL_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`methods.${method}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {t("save")}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
