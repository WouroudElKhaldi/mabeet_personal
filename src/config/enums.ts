import type { BookingStatus, FeedSource, HostContact, PaymentMethod, PhotoArea } from "@prisma/client";

// Value lists shared by validation, the AI tools and the screens. `satisfies` checks them against the
// database enums, so adding a status in the schema cannot silently miss a list here.

export const BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const satisfies readonly BookingStatus[];

/** Statuses that hold the nights or seats: a request waiting, a payment due, or confirmed. */
export const ACTIVE_BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
  "CONFIRMED",
] as const satisfies readonly BookingStatus[];

/** Active statuses that end when their time runs out: a request nobody answered, a payment nobody made. */
export const EXPIRING_BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
] as const satisfies readonly BookingStatus[];

export const isActiveBooking = (status: BookingStatus): boolean =>
  (ACTIVE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);

export const FEED_SOURCES = [
  "AIRBNB",
  "BOOKING",
  "KAZDERNI",
  "OTHER",
] as const satisfies readonly FeedSource[];

/** Sources a host can pick for a manual block (platforms with a feed are imported, not typed in). */
export const BLOCK_SOURCES = ["KAZDERNI", "OTHER"] as const satisfies readonly FeedSource[];

/** How a guest pays a booking online: Whish, or a card through Stripe. */
export const ONLINE_PAYMENT_METHODS = ["WHISH", "CARD"] as const;
export type OnlineMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

/** Ways a host records money received by hand. Online providers record their own payments. */
export const MANUAL_PAYMENT_METHODS = [
  "WHISH",
  "OMT",
  "CASH",
  "BANK_TRANSFER",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

/** Ways a host can pay Mabeet for a plan by hand, as the super admin lists them. Cards go through Stripe. */
export const PLAN_PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "WHISH",
  "OMT",
  "CRYPTO",
  "CASH",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

/** How guests reach a host on all their listings: both buttons, WhatsApp only, or the Contact host page only. */
export const HOST_CONTACT_OPTIONS = ["BOTH", "WHATSAPP", "MESSAGE"] as const satisfies readonly HostContact[];

export const CURRENCIES = ["USD", "LBP", "EUR"] as const;

/** Analytics cover the current place, or every place the member can see. */
export const ANALYTICS_SCOPES = ["place", "all"] as const;
export type AnalyticsScope = (typeof ANALYTICS_SCOPES)[number];

/** What an AI report can cover. */
export const REPORT_TOPICS = ["occupancy", "revenue", "channels", "requests", "reviews", "places"] as const;
export type ReportTopic = (typeof REPORT_TOPICS)[number];

/** Parts of a place a photo can show, in the order the photo tour lists them. */
export const PHOTO_AREAS = [
  "LIVING_ROOM",
  "KITCHEN",
  "DINING",
  "BEDROOM",
  "BATHROOM",
  "EXTERIOR",
  "TERRACE",
  "GARDEN",
  "POOL",
  "VIEW",
  "OTHER",
] as const satisfies readonly PhotoArea[];
