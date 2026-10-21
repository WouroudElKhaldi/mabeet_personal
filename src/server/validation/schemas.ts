import { z } from "zod";
import { AMENITIES } from "@/config/amenities";
import { toDateRange } from "@/lib/dates";
import { ALL_PERMISSIONS, type Permission } from "@/server/auth/permissions";

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
  status: z.enum(["HELD", "CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"]).optional(),
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
});

export const roomUpdate = roomInput.partial().extend({ active: z.boolean().optional() });

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

/** Public search; anything malformed is dropped rather than failing the page. */
export const searchParams = z.object({
  area: z.string().trim().max(60).optional().catch(undefined),
  q: z.string().trim().max(120).optional().catch(undefined),
  category: z.string().max(40).optional().catch(undefined),
  guests: z.coerce.number().int().min(1).max(30).catch(1),
  maxPrice: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined),
  checkIn: isoDate.optional().catch(undefined),
  checkOut: isoDate.optional().catch(undefined),
});

const feedSource = z.enum(["AIRBNB", "BOOKING", "KAZDERNI", "OTHER"]);

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
    currency: z.enum(["USD", "LBP", "EUR"]),
    lbpRate: z.number().int().min(1).max(10_000_000).nullish(),
    commissionRateBps: z.number().int().min(0).max(5_000),
    depositPercent: z.number().int().min(0).max(100),
    holdHours: z.number().int().min(1).max(168),
    depositInstructions: optionalText(1000),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
    houseRules: optionalText(2000),
    cancellationPolicy: optionalText(2000),
    listedPublicly: z.boolean(),
    categories: z.array(z.string().min(1).max(40)).max(6),
  })
  .partial();

export const paymentInput = z.object({
  amountCents: z.number().int().min(1).max(100_000_000),
  method: z.enum(["CASH", "WHISH", "OMT", "BANK_TRANSFER", "OTHER"]),
  note: z.string().trim().max(300).nullish(),
});

export const workspaceParams = z.object({ businessId: id });
export const blockParams = workspaceParams.extend({ blockId: id });
export const feedParams = workspaceParams.extend({ feedId: id });
export const roomParams = workspaceParams.extend({ roomId: id });
export const bookingParams = workspaceParams.extend({ bookingId: id });
export const roleParams = workspaceParams.extend({ roleId: id });
export const memberParams = workspaceParams.extend({ membershipId: id });

export const reviewParams = workspaceParams.extend({ reviewId: id });

export const reviewUpdate = z.union([
  z.object({ reply: z.string().trim().min(1).max(1000) }),
  z.object({ hiddenReason: z.string().trim().min(3).max(300).nullable() }),
]);

export const reviewInput = z.object({
  bookingId: id,
  rating: z.number().int().min(1).max(5),
  cleanliness: z.number().int().min(1).max(5).optional(),
  location: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(10).max(2000),
});

export const chatInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The last message must be from the user",
    }),
});

export const keyInput = z.object({
  name: z.string().trim().min(2).max(60),
  canWrite: z.boolean().default(false),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});

export const keyParams = workspaceParams.extend({ keyId: id });
