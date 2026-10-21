"use client";

import { clsx } from "clsx";
import { Languages, Monitor, Moon, Palette as PaletteIcon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { COLOR_MODES, type ColorMode, PALETTE_SWATCH, PALETTES } from "@/config/appearance";
import { useAppearance } from "./appearance-provider";

const MODE_ICON: Record<ColorMode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

export function AppearanceMenu() {
  const t = useTranslations("appearance");
  const { mode, palette, setMode, setPalette } = useAppearance();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !panel.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const switchLocale = (next: string) =>
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("open")}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
      >
        <PaletteIcon className="size-[1.15rem]" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("title")}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute end-0 top-12 z-50 w-72 origin-top-right rounded-lg bg-surface p-4 shadow-lift ring-1 ring-line rtl:origin-top-left"
          >
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">{t("mode")}</p>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
              {COLOR_MODES.map((option) => {
                const Icon = MODE_ICON[option];
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    onClick={() => setMode(option)}
                    className="relative flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-semibold"
                  >
                    {mode === option && (
                      <motion.span
                        layoutId="mode-pill"
                        className="absolute inset-0 rounded-full bg-surface shadow-soft"
                        transition={{ type: "spring", stiffness: 500, damping: 36 }}
                      />
                    )}
                    <Icon className="relative size-4" aria-hidden />
                    <span className="relative">{t(option)}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 mb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">
              {t("palette")}
            </p>
            <div className="flex gap-2.5">
              {PALETTES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={palette === option}
                  aria-label={t(`palettes.${option}`)}
                  title={t(`palettes.${option}`)}
                  onClick={() => setPalette(option)}
                  style={{ backgroundColor: PALETTE_SWATCH[option] }}
                  className={clsx(
                    "size-9 rounded-full ring-offset-2 ring-offset-surface transition-transform duration-300 ease-(--ease-spring) hover:scale-110",
                    palette === option && "ring-2 ring-ink",
                  )}
                />
              ))}
            </div>

            <p className="mt-5 mb-2 flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-muted uppercase">
              <Languages className="size-3.5" aria-hidden />
              {t("language")}
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
              {(["en", "ar"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={locale === option}
                  onClick={() => switchLocale(option)}
                  className={clsx(
                    "h-9 rounded-full text-sm font-semibold transition-colors",
                    locale === option ? "bg-surface shadow-soft" : "text-muted hover:text-ink",
                  )}
                >
                  {option === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
