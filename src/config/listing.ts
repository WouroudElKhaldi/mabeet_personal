// Fixed vocabularies for listings. Stored as keys; labels live in messages/*.json, so search filters stay clean.

/** What a guest can book. "all" is only a browsing tab, never stored. */
export const LISTING_TABS = ["all", "homes", "experiences", "services"] as const;
export type ListingTab = (typeof LISTING_TABS)[number];

export const TAB_KIND = { homes: "HOME", experiences: "EXPERIENCE", services: "SERVICE" } as const;

/** Tags owners pick for a place or an offering, and guests filter by. */
export const TAGS = [
  "family-friendly",
  "romantic",
  "pet-friendly",
  "work-friendly",
  "group-friendly",
  "hiking-nearby",
  "sea-view",
  "mountain-view",
  "historic",
  "eco-friendly",
  "quiet",
  "local-food",
] as const;

/** Accessibility features, shown under "Things to know" and usable as a filter. */
export const ACCESSIBILITY = [
  "step-free-access",
  "step-free-bathroom",
  "disabled-parking",
  "flat-ground",
  "wide-doorways",
  "low-sensory",
] as const;

export const LANGUAGES = ["ar", "en", "fr"] as const;

export const ACTIVITY_LEVELS = ["LIGHT", "MODERATE", "CHALLENGING"] as const;
export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const PRICE_UNITS = ["PER_PERSON", "PER_GROUP"] as const;

export const keepKnown = <T extends string>(allowed: readonly T[], values: readonly string[]): T[] =>
  values.filter((value): value is T => (allowed as readonly string[]).includes(value));
