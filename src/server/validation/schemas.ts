import { z } from "zod";
import {
  BOOKING_STATUSES,
  CURRENCIES,
  FEED_SOURCES,
  MANUAL_PAYMENT_METHODS,
  PLAN_PAYMENT_METHODS,
} from "@/config/enums";
import { AMENITIES } from "@/config/amenities";
import { PALETTES } from "@/config/appearance";
import {
  ACCESSIBILITY,
  ACTIVITY_LEVELS,
  keepKnown,
  LANGUAGES,
  LISTING_TABS,
  PRICE_UNITS,
  SKILL_LEVELS,
  TAGS,
} from "@/config/listing";
import { toDateRange } from "@/lib/dates";
import { ALL_PERMISSIONS, type Permission } from "@/server/auth/permissions";
import { isPushServiceUrl } from "@/server/push/send";

const id = z.string().min(1).max(64);

const isoDate = z.iso.date();

export const stayDates = z
  .object({ checkIn: isoDate, checkOut: isoDate })
  .refine(({ checkIn, checkOut }) => checkOut > checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

/** International format, e.g. +96171123456. */
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +96171123456");

export const bookingRequest = z
  .object({
    roomId: id,
    guestCount: z.number().int().min(1).max(30),
    guestName: z.string().trim().min(2).max(80),
    guestPhone: phone,
    guestEmail: z.email().max(254).nullish(),
    guestNote: z.string().trim().max(1000).nullish(),
  })
  .and(stayDates);

export const decision = z.object({ reason: z.string().trim().max(500).optional() });

export const bookingFilters = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  roomId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const cents = z.number().int().min(0).max(10_000_000);

export const roomInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(4000).nullish(),
  capacity: z.number().int().min(1).max(30),
  bedrooms: z.number().int().min(0).max(30).default(1),
  beds: z.number().int().min(0).max(60).default(1),
  bathrooms: z.number().int().min(0).max(30).default(1),
  baseRateCents: cents,
  minNights: z.number().int().min(1).max(60).default(1),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).default([]),
  /** Guests can book it (when the place books by room) and see it. */
  active: z.boolean().default(true),
});

export const roomUpdate = roomInput.partial();

const MAX_PRICE_NIGHTS = 366;

/** A special price for each night in a range, or null to go back to the base rate. */
export const specialPriceInput = z
  .object({ checkIn: isoDate, checkOut: isoDate, rateCents: cents.nullable() })
  .refine(
    ({ checkIn, checkOut }) =>
      checkOut > checkIn && Date.parse(checkOut) - Date.parse(checkIn) <= MAX_PRICE_NIGHTS * 86_400_000,
    { message: `Pick up to ${MAX_PRICE_NIGHTS} nights, ending after they start`, path: ["checkOut"] },
  );

export const workspaceInput = z.object({
  name: z.string().trim().min(2).max(80),
  area: z.string().trim().max(80).optional(),
  phone: phone.optional(),
});

export const roleInput = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).nullish(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).max(ALL_PERMISSIONS.length),
});

export const memberInput = z.object({ email: z.email(), roleId: id });

export const memberUpdate = z.object({ roleId: id });

export const publicRoomParams = z.object({ slug: z.string().min(1).max(64), roomId: id });

const MAX_WINDOW_DAYS = 400;

const windowFields = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => to > from && Date.parse(to) - Date.parse(from) <= MAX_WINDOW_DAYS * 86_400_000, {
    message: `"to" must be after "from" and within ${MAX_WINDOW_DAYS} days`,
  });

/** A ?from=&to= reporting or calendar window, parsed straight into a DateRange. */
export const dateWindow = windowFields.transform(({ from, to }) =>
  toDateRange({ checkIn: from, checkOut: to }),
);

/** "a,b,c" in the URL -> only the known values, so a shared link never breaks the page. */
const csvOf = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .max(600)
    .optional()
    .transform((value) => keepKnown(allowed, value ? value.split(",") : []))
    .catch([]);

const slugList = z
  .string()
  .max(600)
  .optional()
  .transform((value) => (value ? value.split(",").filter((slug) => /^[a-z0-9-]{1,40}$/.test(slug)) : []))
  .catch([]);

const price = z.coerce.number().int().min(1).max(100_000).optional().catch(undefined);

/** Public search; anything malformed is dropped rather than failing the page. */
export const searchParams = z.object({
  type: z.enum(LISTING_TABS).catch("all"),
  area: z.string().trim().max(60).optional().catch(undefined),
  q: z.string().trim().max(120).optional().catch(undefined),
  category: slugList,
  tags: csvOf(TAGS),
  amenities: csvOf(AMENITIES),
  access: csvOf(ACCESSIBILITY),
  guests: z.coerce.number().int().min(1).max(30).catch(1),
  minPrice: price,
  maxPrice: price,
  checkIn: isoDate.optional().catch(undefined),
  checkOut: isoDate.optional().catch(undefined),
});

const feedSource = z.enum(FEED_SOURCES);

export const calendarQuery = windowFields
  .and(z.object({ roomId: id.optional() }))
  .transform(({ from, to, roomId }) => ({ range: toDateRange({ checkIn: from, checkOut: to }), roomId }));

export const blockInput = z
  .object({
    roomId: id,
    source: feedSource.nullish(),
    note: z.string().trim().max(200).nullish(),
  })
  .and(stayDates);

export const blockMoveInput = z.object({ roomId: id }).and(stayDates);

export const feedInput = z.object({ roomId: id, url: z.url().max(2000), source: feedSource });

const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const settingsInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: optionalText(4000),
    area: optionalText(80),
    address: optionalText(200),
    phone: phone.nullish(),
    whatsapp: phone.nullish(),
    currency: z.enum(CURRENCIES),
    lbpRate: z.number().int().min(1).max(10_000_000).nullish(),
    commissionRateBps: z.number().int().min(0).max(5_000),
    depositPercent: z.number().int().min(0).max(100),
    holdHours: z.number().int().min(1).max(168),
    depositInstructions: optionalText(1000),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
    houseRules: optionalText(2000),
    cancellationPolicy: optionalText(2000),
    bookingMode: z.enum(["REQUEST", "INSTANT"]),
    paymentCollection: z.enum(["AT_PLACE", "ONLINE"]),
    onlineAmount: z.enum(["DEPOSIT", "FULL"]),
    refundPolicy: z.enum(["FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE"]),
    listedPublicly: z.boolean(),
    bookingUnit: z.enum(["ROOMS", "WHOLE_PLACE"]),
    categories: z.array(z.string().min(1).max(40)).max(6),
    tags: z.array(z.enum(TAGS)).max(TAGS.length),
    accessibility: z.array(z.enum(ACCESSIBILITY)).max(ACCESSIBILITY.length),
    minGuestAge: z.number().int().min(0).max(99).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .partial();

export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phone.nullish(),
});

export const analyticsQuery = windowFields.extend({ scope: z.enum(["place", "all"]).default("place") });

export const reportInput = z.object({
  from: isoDate,
  to: isoDate,
  scope: z.enum(["place", "all"]),
  topics: z
    .array(z.enum(["occupancy", "revenue", "channels", "requests", "reviews", "places"]))
    .min(1)
    .max(6),
});

export const hostProfileInput = z.object({
  displayName: optionalText(80),
  bio: optionalText(1500),
  phone: phone.nullish(),
  whatsapp: phone.nullish(),
  city: optionalText(80),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length),
  hostingSince: z.number().int().min(1950).max(2100).nullish(),
  showOnListings: z.boolean(),
});

export const payoutRequestInput = z
  .object({
    amountCents: z.number().int().min(100).max(100_000_000),
    currency: z.enum(CURRENCIES),
    method: z.enum(["BANK_TRANSFER", "WHISH"]),
    accountName: z.string().trim().min(2).max(120),
    bankName: z.string().trim().min(2).max(120).nullish(),
    // International Bank Account Number: country code, check digits, then up to 30 letters or digits.
    iban: z
      .string()
      .transform((value) => value.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "Enter a valid IBAN"))
      .nullish(),
    whishPhone: phone.nullish(),
  })
  .refine((input) => (input.method === "BANK_TRANSFER" ? Boolean(input.iban && input.bankName) : true), {
    message: "Bank transfers need the bank's name and an IBAN",
    path: ["iban"],
  })
  .refine((input) => (input.method === "WHISH" ? Boolean(input.whishPhone) : true), {
    message: "Whish payouts need the Whish phone number",
    path: ["whishPhone"],
  });

export const payoutDecisionInput = z.object({
  action: z.enum(["paid", "rejected"]),
  reference: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const refundSentInput = z.object({ reference: z.string().trim().max(120).nullish() });

/** How a guest pays a booking online. */
export const bookingCheckoutInput = z.object({ method: z.enum(["WHISH", "CARD"]) });

export const whishCallbackQuery = z.object({
  payment: id.optional(),
  plan: id.optional(),
  attempt: z.literal("failed").optional(),
});

// The simulated Whish server takes Whish's own request bodies.
export const whishCreateBody = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().max(3),
  invoice: z.string().max(300).optional(),
  externalId: z.string().min(1).max(64),
  successCallbackUrl: z.url(),
  failureCallbackUrl: z.url(),
  successRedirectUrl: z.url(),
  failureRedirectUrl: z.url(),
});
export const whishReferenceBody = z.object({
  currency: z.string().max(3),
  externalId: z.string().min(1).max(64),
  refundReason: z.string().max(300).optional(),
});
export const whishPayInput = z.object({
  phone: z.string().trim().min(6).max(20),
  otp: z.string().trim().min(4).max(8),
});

export const paymentInput = z.object({
  amountCents: z.number().int().min(1).max(100_000_000),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  note: z.string().trim().max(300).nullish(),
});

export const workspaceParams = z.object({ businessId: id });
export const blockParams = workspaceParams.extend({ blockId: id });
export const feedParams = workspaceParams.extend({ feedId: id });
export const roomParams = workspaceParams.extend({ roomId: id });
export const planRequestParams = workspaceParams.extend({ requestId: id });
export const bookingParams = workspaceParams.extend({ bookingId: id });
export const roleParams = workspaceParams.extend({ roleId: id });
export const memberParams = workspaceParams.extend({ membershipId: id });

export const reviewParams = workspaceParams.extend({ reviewId: id });

export const reviewUpdate = z.union([
  z.object({ reply: z.string().trim().min(1).max(1000) }),
  z.object({ hiddenReason: z.string().trim().min(3).max(300).nullable() }),
]);

/** A review names the stay (bookingId) or the seats in a session (sessionBookingId), never both. */
export const reviewInput = z
  .object({
    bookingId: id.optional(),
    sessionBookingId: id.optional(),
    rating: z.number().int().min(1).max(5),
    cleanliness: z.number().int().min(1).max(5).optional(),
    location: z.number().int().min(1).max(5).optional(),
    value: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().min(10).max(2000),
  })
  .refine((input) => Boolean(input.bookingId) !== Boolean(input.sessionBookingId), {
    message: "Name either a stay or an experience booking",
  });

export const chatInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The last message must be from the user",
    }),
  /** The saved chat this continues; none starts a new one. */
  chatId: z.string().min(1).max(64).nullish(),
  /** A temporary chat is answered but never stored. */
  temporary: z.boolean().default(false),
});

export const chatParams = z.object({ chatId: z.string().min(1).max(64) });

export const keyInput = z.object({
  name: z.string().trim().min(2).max(60),
  canWrite: z.boolean().default(false),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});

export const keyParams = workspaceParams.extend({ keyId: id });

export const businessStatusInput = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export const siteSettingsInput = z.object({ palette: z.enum(PALETTES) });

/** A paid plan to start through Stripe Checkout. */
export const checkoutInput = z.object({ plan: z.enum(["PRO", "BUSINESS"]) });

export const paymentOptionInput = z.object({
  method: z.enum(PLAN_PAYMENT_METHODS),
  label: z.string().trim().min(2).max(80),
  details: z.string().trim().min(3).max(1000),
  active: z.boolean().default(true),
  position: z.number().int().min(0).max(999).default(0),
});

export const paymentOptionUpdate = paymentOptionInput.partial();

/** The fields of a manual plan request; the receipt comes as the multipart `receipt` file. */
export const planRequestFields = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
  months: z.coerce.number().int().min(1).max(12),
  optionId: z.string().min(1).max(64),
  payerReference: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const planRequestDecision = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).nullish(),
});

const categoryFields = z.object({
  nameEn: z.string().trim().min(2).max(40),
  nameAr: z.string().trim().min(2).max(40),
  icon: z.string().trim().min(1).max(40),
  position: z.number().int().min(0).max(999),
});

/** A new category. Its slug and kind never change afterwards: listings and links point at them. */
export const categoryInput = categoryFields.extend({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .max(40),
  kind: z.enum(["HOME", "EXPERIENCE", "SERVICE"]),
});
export const categoryUpdate = categoryFields.partial();
export const categoryParams = z.object({ slug: z.string().min(1).max(40) });

// ---------- Experiences and services ----------

const listItems = z.array(z.string().trim().min(1).max(160)).max(12);

export const offeringInput = z.object({
  kind: z.enum(["EXPERIENCE", "SERVICE"]),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(4000).nullish(),
  categorySlug: z.string().max(40).nullish(),
  area: z.string().trim().max(80).nullish(),
  meetingPoint: z.string().trim().max(200).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  durationMinutes: z.number().int().min(15).max(1440),
  priceCents: cents,
  priceUnit: z.enum(PRICE_UNITS),
  maxGuests: z.number().int().min(1).max(100),
  minAge: z.number().int().min(0).max(99).nullish(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullish(),
  skillLevel: z.enum(SKILL_LEVELS).nullish(),
  included: listItems.default([]),
  notIncluded: listItems.default([]),
  accessibility: z.array(z.enum(ACCESSIBILITY)).max(ACCESSIBILITY.length).default([]),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).default([]),
  tags: z.array(z.enum(TAGS)).max(TAGS.length).default([]),
  cancellationHours: z.number().int().min(0).max(720).default(24),
});

export const offeringUpdate = offeringInput.partial().extend({ active: z.boolean().optional() });

export const offeringParams = workspaceParams.extend({ offeringId: id });
export const sessionParams = workspaceParams.extend({ sessionId: id });
export const sessionBookingParams = workspaceParams.extend({ bookingId: id });

/** Schedule one session per date at the same local start time. */
export const sessionsInput = z.object({
  dates: z.array(isoDate).min(1).max(60),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  capacity: z.number().int().min(1).max(500),
});

export const sessionBookingRequest = z.object({
  sessionId: id,
  seats: z.number().int().min(1).max(100),
  guestName: z.string().trim().min(2).max(80),
  guestPhone: phone,
  guestEmail: z.email().max(254).nullish(),
  guestNote: z.string().trim().max(1000).nullish(),
});

const pushEndpoint = z.url().max(2048).refine(isPushServiceUrl, "Unsupported push service");

/** A browser's PushSubscription.toJSON(), flattened to what the server stores. */
export const pushSubscribe = z
  .object({
    endpoint: pushEndpoint,
    keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(64) }),
  })
  .transform(({ endpoint, keys }) => ({ endpoint, ...keys }));

export const pushUnsubscribe = z.object({ endpoint: z.string().max(2048) });
