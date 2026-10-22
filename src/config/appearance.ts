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

const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export const isRtl = (locale: Locale) => locale === "ar";
