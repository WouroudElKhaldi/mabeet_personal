/** What a visitor may choose. Until they pick, the site follows their device's light or dark setting. */
export type ColorMode = "light" | "dark";

/**
 * Accent palettes, named after places in Lebanon. Each is defined in globals.css.
 * The palette is website-wide and only a super admin changes it (SiteSetting.palette).
 */
export const PALETTES = ["cedar", "terracotta", "sea", "olive", "jacaranda"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "cedar";

export function isPalette(value: string): value is Palette {
  return (PALETTES as readonly string[]).includes(value);
}

export const PALETTE_SWATCH: Record<Palette, string> = {
  cedar: "#245c45",
  terracotta: "#b4532f",
  sea: "#1f5f86",
  olive: "#6d6a2c",
  jacaranda: "#6b4b93",
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
