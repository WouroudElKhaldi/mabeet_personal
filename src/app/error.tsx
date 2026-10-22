"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  // The server already logged the details; the digest ties this screen to that log line.
  useEffect(() => console.error(error), [error]);

  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">{t("errorTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("errorBody")}</p>
        {error.digest && <p className="mt-2 text-xs text-faint">#{error.digest}</p>}
        <Button className="mt-8" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
