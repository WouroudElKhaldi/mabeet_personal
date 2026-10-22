/** Icon names a category can use (Category.icon). Each has a drawing in components/place/category-icon.tsx. */
export const CATEGORY_ICONS = [
  "mountain",
  "beach",
  "countryside",
  "old-town",
  "guesthouse",
  "cabin",
  "camping",
  "vineyard",
  "ski",
  "hiking",
  "food-wine",
  "culture",
  "water",
  "workshops",
  "transfers",
  "private-chef",
  "guides",
  "photography",
  "wellness",
] as const;
export type CategoryIconName = (typeof CATEGORY_ICONS)[number];
