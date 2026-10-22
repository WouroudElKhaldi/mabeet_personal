import type { BookingStatus, FeedSource, PaymentMethod } from "@prisma/client";

// Value lists shared by validation, the AI tools and the screens. `satisfies` checks them against the
// database enums, so adding a status in the schema cannot silently miss a list here.

export const BOOKING_STATUSES = [
  "HELD",
  "CONFIRMED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const satisfies readonly BookingStatus[];

export const FEED_SOURCES = [
  "AIRBNB",
  "BOOKING",
  "KAZDERNI",
  "OTHER",
] as const satisfies readonly FeedSource[];

/** Sources a host can pick for a manual block (platforms with a feed are imported, not typed in). */
export const BLOCK_SOURCES = ["KAZDERNI", "OTHER"] as const satisfies readonly FeedSource[];

/** Ways a host records money received by hand. Online providers record their own payments. */
export const MANUAL_PAYMENT_METHODS = [
  "WHISH",
  "OMT",
  "CASH",
  "BANK_TRANSFER",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

export const CURRENCIES = ["USD", "LBP", "EUR"] as const;
