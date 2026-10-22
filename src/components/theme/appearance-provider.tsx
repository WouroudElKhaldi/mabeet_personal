"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";
import { COLOR_MODE_STORAGE_KEY, type ColorMode } from "@/config/appearance";

interface AppearanceContextValue {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const systemMode = (): ColorMode => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function readSaved(): ColorMode | null {
  try {
    const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function apply(mode: ColorMode) {
  const update = () => {
    document.documentElement.dataset.mode = mode;
  };
  // A soft cross-fade between modes where the browser supports it.
  if ("startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

/** Light or dark is the visitor's choice; until they make one, it follows their device. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>("light");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    const saved = readSaved();
    setModeState(saved ?? systemMode());
    setChosen(saved !== null);
  }, []);

  useEffect(() => {
    if (chosen) return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      setModeState(systemMode());
      apply(systemMode());
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [chosen]);

  const setMode = useCallback((next: ColorMode) => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice still applies for this visit.
    }
    setModeState(next);
    setChosen(true);
    apply(next);
  }, []);

  const value = useMemo<AppearanceContextValue>(() => ({ mode, setMode }), [mode, setMode]);
  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceContextValue {
  const context = use(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}
