"use client";

import { Check, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { useInstallPrompt } from "./install-prompt";

/**
 * Installs Mabeet in one tap where the browser allows it. With `hints`, it also says how on iPhone or from the
 * browser menu, and confirms when the app is already installed; without, it only appears when one tap works.
 */
export function InstallButton({ hints = true }: { hints?: boolean }) {
  const t = useTranslations("pwa");
  const { state, install } = useInstallPrompt();
  if (state === "ready") {
    return (
      <button type="button" onClick={() => void install()} className={buttonClass({ variant: "secondary" })}>
        <Download className="size-4" aria-hidden />
        {t("install")}
      </button>
    );
  }
  if (!hints) return null;
  if (state === "installed") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
        <Check className="size-4" aria-hidden />
        {t("installed")}
      </p>
    );
  }
  return <p className="max-w-prose text-sm">{t(state === "ios" ? "iosSteps" : "manualSteps")}</p>;
}
