"use client";

import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** Lets the guest cancel from their booking page, after confirming and optionally telling the host why. */
export function GuestCancelButton({ token, confirmed }: { token: string; confirmed: boolean }) {
  const t = useTranslations("confirmation");
  const tConfirm = useTranslations("confirm.guestCancel");
  const { run, pending, error } = useAction();
  const [ask, confirmDialog] = useConfirm();

  const cancel = async () => {
    const answer = await ask({
      title: tConfirm("title"),
      body: tConfirm(confirmed ? "bodyConfirmed" : "bodyHeld"),
      confirmLabel: tConfirm("confirm"),
      danger: true,
      reason: { label: tConfirm("reason") },
    });
    if (answer.confirmed) {
      run(() =>
        api.post(`/api/public/bookings/${token}/cancel`, answer.reason ? { reason: answer.reason } : {}),
      );
    }
  };

  return (
    <div className="mt-6">
      {confirmDialog}
      <button
        type="button"
        disabled={pending}
        onClick={() => void cancel()}
        className="text-sm font-semibold text-danger underline underline-offset-4 disabled:opacity-50"
      >
        {t("cancelBooking")}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
