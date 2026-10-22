/** What a visitor may choose. Until they pick, the site follows their device's light or dark setting. */
export type ColorMode = "light" | "dark";

/**
 * Palettes, named after places in Lebanon. Each is a full colour set defined in globals.css.
 * The palette is website-wide and only a super admin changes it (SiteSetting.palette).
 */
export const PALETTES = ["cedar", "byblos", "batroun", "baalbek", "jounieh"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "cedar";

export function isPalette(value: string): value is Palette {
  return (PALETTES as readonly string[]).includes(value);
}

/** Each palette's canvas, primary, second accent and ink, for the admin's picker. */
export const PALETTE_SWATCH: Record<Palette, readonly [string, string, string, string]> = {
  cedar: ["#fbf8f1", "#1f5c44", "#b8893b", "#1d2a24"],
  byblos: ["#f9f6f0", "#1f3b63", "#c2603f", "#16233a"],
  batroun: ["#fcf7f1", "#a8472a", "#6d7f3b", "#2e211b"],
  baalbek: ["#f8f5f1", "#5c2a4d", "#c49a3c", "#2a1c26"],
  jounieh: ["#f7f8fa", "#23324f", "#b08a4a", "#141b2b"],
};

/** localStorage key for the visitor's light/dark choice. */
export const COLOR_MODE_STORAGE_KEY = "color-mode";

/** English, Modern Standard Arabic, and Lebanese Arabic ("ar-LB", the way people actually talk in Lebanon). */
const LOCALES = ["en", "ar", "ar-LB"] as const;
export type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Both Arabic variants read right to left and use the Arabic names stored on categories. */
export const isArabic = (locale: string) => locale.startsWith("ar");

/** The saved choice wins; otherwise the browser's languages decide (Lebanese for ar-LB, else Arabic or English). */
export function pickLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(saved)) return saved;
  const accepted = (acceptLanguage ?? "").toLowerCase();
  if (accepted.startsWith("ar-lb")) return "ar-LB";
  return accepted.startsWith("ar") ? "ar" : DEFAULT_LOCALE;
}

/** A category's name in the visitor's language. */
export function categoryName(category: { nameEn: string; nameAr: string }, locale: string): string {
  return isArabic(locale) ? category.nameAr : category.nameEn;
}
