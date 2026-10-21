"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
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
  const base = `/api/workspaces/${businessId}/reviews/${reviewId}`;

  const submitReply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(() => api.patch(base, { reply: new FormData(event.currentTarget).get("reply") }));
  };

  const toggleVisibility = () => {
    const reason = hidden ? null : window.prompt(t("hideReason"));
    if (!hidden && !reason) return;
    run(() => api.patch(base, { hiddenReason: reason }));
  };

  return (
    <div className="grid gap-3">
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
        <Button size="sm" variant="ghost" disabled={pending} onClick={toggleVisibility}>
          {hidden ? t("show") : t("hide")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
