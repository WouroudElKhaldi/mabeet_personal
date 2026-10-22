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
      <div className="flex flex-wrap gap-3">
        {PALETTES.map((palette) => (
          <button
            key={palette}
            type="button"
            disabled={pending}
            aria-pressed={current === palette}
            onClick={() => run(() => api.patch("/api/admin/site", { palette }))}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ring-1 transition-shadow",
              current === palette ? "ring-2 ring-ink" : "ring-line hover:ring-line-strong",
            )}
          >
            <span
              className="grid size-7 place-items-center rounded-full text-white"
              style={{ backgroundColor: PALETTE_SWATCH[palette] }}
            >
              {current === palette && <Check className="size-4" aria-hidden />}
            </span>
            {t(`palettes.${palette}`)}
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
