"use client";

import { clsx } from "clsx";
import { Check, ShieldQuestion, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/api-client";
import type { ProposedAction } from "@/server/ai/assistant";

type CardState = "waiting" | "running" | "done" | "dismissed";

/** Tool names with a label in messages (assistant.team.actions.tools); anything else is shown as its raw name. */
const KNOWN_TOOLS = ["confirm_booking", "decline_booking", "cancel_booking", "close_dates", "reopen_dates"];
const KNOWN_FIELDS = [
  "place",
  "reference",
  "room",
  "checkIn",
  "checkOut",
  "source",
  "note",
  "reason",
  "blockId",
];

/**
 * A change the assistant proposed, waiting for the member. It shows the exact tool input (already validated on
 * the server), never the model's wording, so what you confirm is what runs. Nothing is sent until Confirm.
 */
export function ActionCard({ businessId, action }: { businessId: string; action: ProposedAction }) {
  const t = useTranslations("assistant.team.actions");
  const tCommon = useTranslations("common");
  const [state, setState] = useState<CardState>("waiting");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setState("running");
    setError(null);
    try {
      await api.post(`/api/workspaces/${businessId}/assistant/actions`, action);
      setState("done");
    } catch (caught) {
      setError(errorMessage(caught, tCommon("error")));
      setState("waiting");
    }
  };

  const toolLabel = KNOWN_TOOLS.includes(action.tool)
    ? t(`tools.${action.tool as "confirm_booking"}`)
    : action.tool;
  const details = KNOWN_FIELDS.filter(
    (field) => action.input[field] !== undefined && action.input[field] !== "",
  );

  return (
    <div
      className={clsx(
        "ms-11 max-w-md rounded-xl p-4 ring-1",
        state === "done" ? "bg-success/5 ring-success/40" : "bg-surface ring-accent",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-muted uppercase">
        <ShieldQuestion className="size-4 text-accent" aria-hidden />
        {state === "done" ? t("done") : state === "dismissed" ? t("dismissed") : t("title")}
      </p>
      <p className="mt-2 font-semibold">{toolLabel}</p>
      {details.length > 0 && (
        <dl className="mt-2 grid gap-1 text-sm">
          {details.map((field) => (
            <div key={field} className="flex justify-between gap-3">
              <dt className="text-muted">{t(`fields.${field as "reference"}`)}</dt>
              <dd className="font-medium [unicode-bidi:plaintext]">{String(action.input[field])}</dd>
            </div>
          ))}
        </dl>
      )}
      {(state === "waiting" || state === "running") && (
        <>
          <p className="mt-3 text-xs text-muted">{t("hint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={state === "running"} onClick={() => void confirm()}>
              <Check className="size-4" aria-hidden />
              {t("confirm")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={state === "running"}
              onClick={() => setState("dismissed")}
            >
              <X className="size-4" aria-hidden />
              {t("cancel")}
            </Button>
          </div>
        </>
      )}
      <FormError message={error} className="mt-3" />
    </div>
  );
}
