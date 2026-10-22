"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Palette, PALETTE_SWATCH, PALETTES } from "@/config/appearance";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** Super admin only: the website's colour palette, applied for every visitor. */
export function SitePalettePicker({ current }: { current: Palette }) {
  const t = useTranslations("admin.theme");
  const { run, pending, error } = useAction();
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PALETTES.map((palette) => (
          <button
            key={palette}
            type="button"
            disabled={pending}
            aria-pressed={current === palette}
            onClick={() => run(() => api.patch("/api/admin/site", { palette }))}
            className={clsx(
              "overflow-hidden rounded-xl bg-surface text-start ring-1 transition-shadow",
              current === palette ? "ring-2 ring-accent" : "ring-line hover:ring-line-strong",
            )}
          >
            <span className="flex h-16" aria-hidden>
              {PALETTE_SWATCH[palette].map((colour, index) => (
                <span
                  key={colour}
                  className={index === 0 ? "flex-[2]" : "flex-1"}
                  style={{ backgroundColor: colour }}
                />
              ))}
            </span>
            <span className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">{t(`palettes.${palette}`)}</span>
                <span className="block text-xs text-muted">{t(`paletteNotes.${palette}`)}</span>
              </span>
              {current === palette && <Check className="size-5 shrink-0 text-accent" aria-hidden />}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
