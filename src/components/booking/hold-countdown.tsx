"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const REFRESH_EVERY_MS = 30_000;

function remaining(until: number) {
  const ms = Math.max(0, until - Date.now());
  return {
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    done: ms === 0,
  };
}

/** Counts down the hold and quietly refreshes, so the page flips to "confirmed" on its own. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("confirmation");
  const router = useRouter();
  const until = Date.parse(expiresAt);
  const [left, setLeft] = useState(() => remaining(until));

  useEffect(() => {
    const tick = setInterval(() => setLeft(remaining(until)), 15_000);
    const refresh = setInterval(() => router.refresh(), REFRESH_EVERY_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [until, router]);

  return (
    // The time left is counted from the moment it renders: the server's minute and the browser's can differ.
    <p className="font-display text-3xl tabular-nums" aria-live="polite" suppressHydrationWarning>
      {left.done ? t("holdOver") : t("holdLeft", { hours: left.hours, minutes: left.minutes })}
    </p>
  );
}
