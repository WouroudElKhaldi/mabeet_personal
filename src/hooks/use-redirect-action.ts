"use client";

import { useState, useTransition } from "react";
import { errorMessage } from "@/lib/api-client";

/**
 * For steps that end on another site or page (Stripe, Whish, an AI app's OAuth callback): runs a call that
 * returns the next URL and sends the browser there. If the call fails, keeps a message to show instead.
 */
export function useRedirectAction(fallbackMessage: string) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const go = (nextUrl: () => Promise<string>) =>
    startTransition(async () => {
      setError(null);
      try {
        window.location.assign(await nextUrl());
      } catch (caught) {
        setError(errorMessage(caught, fallbackMessage));
      }
    });

  return { go, pending, error };
}
