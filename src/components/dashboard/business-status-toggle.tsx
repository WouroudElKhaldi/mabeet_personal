"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export function BusinessStatusToggle({
  businessId,
  businessName,
  suspended,
}: {
  businessId: string;
  businessName: string;
  suspended: boolean;
}) {
  const t = useTranslations("admin");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error } = useAction();
  const [ask, confirmDialog] = useConfirm();

  const toggle = async () => {
    if (!suspended) {
      const answer = await ask({
        title: tConfirm("suspend.title", { name: businessName }),
        body: tConfirm("suspend.body"),
        confirmLabel: tConfirm("suspend.confirm"),
        danger: true,
      });
      if (!answer.confirmed) return;
    }
    run(() =>
      api.patch(`/api/admin/businesses/${businessId}`, { status: suspended ? "ACTIVE" : "SUSPENDED" }),
    );
  };

  return (
    <>
      {confirmDialog}
      <Button
        size="sm"
        variant={suspended ? "secondary" : "ghost"}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {suspended ? t("reactivate") : t("suspend")}
      </Button>
      {error && <span className="block text-xs font-semibold text-danger">{error}</span>}
    </>
  );
}
