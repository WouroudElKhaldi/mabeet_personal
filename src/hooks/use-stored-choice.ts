"use client";

import { useEffect, useState } from "react";

/**
 * A per-browser preference (a view, a tab) remembered in localStorage. Starts at the fallback so server and first
 * client render match, then switches to the saved value. Storage can be blocked; the fallback then simply stays.
 * Pass `allowed` as a module-level constant so it stays the same between renders.
 */
export function useStoredChoice<Choice extends string>(
  key: string,
  allowed: readonly Choice[],
  fallback: Choice,
): [Choice, (next: Choice) => void] {
  const [choice, setChoice] = useState<Choice>(fallback);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) setChoice(saved as Choice);
    } catch {
      // Storage unavailable: keep the fallback.
    }
  }, [key, allowed]);

  const choose = (next: Choice) => {
    setChoice(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  };

  return [choice, choose];
}
