"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";
import { APPEARANCE_STORAGE_KEY, type ColorMode, type Palette } from "@/config/appearance";

interface Appearance {
  mode: ColorMode;
  palette: Palette;
}

interface AppearanceContextValue extends Appearance {
  setMode: (mode: ColorMode) => void;
  setPalette: (palette: Palette) => void;
}

const DEFAULT_APPEARANCE: Appearance = { mode: "system", palette: "cedar" };

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readSaved(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "{}") };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

const systemPrefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

function apply({ mode, palette }: Appearance) {
  const root = document.documentElement;
  const resolved = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  const update = () => {
    root.dataset.mode = resolved;
    root.dataset.palette = palette;
  };
  // A soft cross-fade between themes where the browser supports it.
  if ("startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => setAppearance(readSaved()), []);

  useEffect(() => {
    if (appearance.mode !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => apply(appearance);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [appearance]);

  const update = useCallback((next: Partial<Appearance>) => {
    setAppearance((current) => {
      const merged = { ...current, ...next };
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(merged));
      apply(merged);
      return merged;
    });
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...appearance,
      setMode: (mode) => update({ mode }),
      setPalette: (palette) => update({ palette }),
    }),
    [appearance, update],
  );

  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceContextValue {
  const context = use(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}
