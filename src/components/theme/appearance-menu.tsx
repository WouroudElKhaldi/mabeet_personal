"use client";

import { clsx } from "clsx";
import { Check, Globe, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { useAppearance } from "./appearance-provider";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "ar-LB", label: "لبناني" },
] as const;

/**
 * Two header controls: a one-tap light/dark switch, and a language menu.
 * The colour palette itself is chosen site-wide by the platform admin.
 */
export function AppearanceMenu() {
  return (
    <div className="flex items-center">
      <ModeToggle />
      <LanguageMenu />
    </div>
  );
}

function ModeToggle() {
  const t = useTranslations("appearance");
  const { mode, setMode } = useAppearance();
  const next = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={t(next === "dark" ? "toDark" : "toLight")}
      title={t(next === "dark" ? "toDark" : "toLight")}
      className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="grid"
        >
          {mode === "dark" ? (
            <Moon className="size-[1.15rem]" aria-hidden />
          ) : (
            <Sun className="size-[1.15rem]" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function LanguageMenu() {
  const t = useTranslations("appearance");
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

  const choose = (code: string) =>
    startTransition(async () => {
      setOpen(false);
      await setLocale(code);
      router.refresh();
    });

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("language")}
        title={t("language")}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
      >
        <Globe className="size-[1.15rem]" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={t("language")}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-12 z-50 w-44 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
          >
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === code}
                onClick={() => choose(code)}
                className={clsx(
                  "flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm transition-colors hover:bg-surface-2",
                  locale === code && "font-semibold",
                )}
              >
                {label}
                {locale === code && <Check className="size-4 text-accent" aria-hidden />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
