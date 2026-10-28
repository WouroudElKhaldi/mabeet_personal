export const AMENITIES = [
  "wifi",
  "parking",
  "breakfast",
  "ac",
  "heating",
  "fireplace",
  "jacuzzi",
  "pool",
  "kitchen",
  "view",
  "garden",
  "pets",
  "generator",
] as const;

export type AmenityKey = (typeof AMENITIES)[number];

export function isAmenity(value: string): value is AmenityKey {
  return (AMENITIES as readonly string[]).includes(value);
}
