"use client";

import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

interface ReviewControlsProps {
  businessId: string;
  reviewId: string;
  reply: string | null;
  hidden: boolean;
}

export function ReviewControls({ businessId, reviewId, reply, hidden }: ReviewControlsProps) {
  const t = useTranslations("dashboard.reviews");
  const { run, pending, error } = useAction();
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  const base = `/api/workspaces/${businessId}/reviews/${reviewId}`;

  const submitReply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(() => api.patch(base, { reply: new FormData(event.currentTarget).get("reply") }));
  };

  const toggleVisibility = async () => {
    if (hidden) return run(() => api.patch(base, { hiddenReason: null }));
    const answer = await ask({
      title: tConfirm("hideReview.title"),
      body: tConfirm("hideReview.body"),
      confirmLabel: tConfirm("hideReview.confirm"),
      danger: true,
      reason: {
        label: tConfirm("hideReview.reason"),
        placeholder: tConfirm("hideReview.placeholder"),
        required: true,
        minLength: 3,
      },
    });
    if (answer.confirmed) run(() => api.patch(base, { hiddenReason: answer.reason }));
  };

  return (
    <div className="grid gap-3">
      {confirmDialog}
      <form onSubmit={submitReply} className="flex flex-wrap gap-2">
        <input
          name="reply"
          required
          maxLength={1000}
          defaultValue={reply ?? ""}
          placeholder={t("replyPlaceholder")}
          aria-label={t("reply")}
          className={`${inputClass} h-10 min-w-0 flex-1`}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {reply ? t("updateReply") : t("reply")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => void toggleVisibility()}>
          {hidden ? t("show") : t("hide")}
        </Button>
      </form>
      <FormError message={error} />
    </div>
  );
}
