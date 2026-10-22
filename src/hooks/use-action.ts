"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ApiError } from "@/lib/api-client";

/** Runs an API call, then refreshes the server-rendered page; keeps the error message for display. */
export function useAction() {
  const router = useRouter();
  const t = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (call: () => Promise<unknown>, onDone?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        await call();
        onDone?.();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : t("error"));
      }
    });

  return { run, pending, error };
}
