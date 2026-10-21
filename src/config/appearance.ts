export const COLOR_MODES = ["system", "light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

/** Accent palettes, named after places in Lebanon. Each is defined in globals.css. */
export const PALETTES = ["cedar", "terracotta", "sea", "olive", "jacaranda"] as const;
export type Palette = (typeof PALETTES)[number];

export const PALETTE_SWATCH: Record<Palette, string> = {
  cedar: "#245c45",
  terracotta: "#b4532f",
  sea: "#1f5f86",
  olive: "#6d6a2c",
  jacaranda: "#6b4b93",
};

export const APPEARANCE_STORAGE_KEY = "appearance";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export const isRtl = (locale: Locale) => locale === "ar";
