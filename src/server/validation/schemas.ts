import { z } from "zod";
import { ALL_PERMISSIONS, type Permission } from "@/server/auth/permissions";

const id = z.string().min(1).max(64);

const isoDate = z.iso.date();

const stayDates = z
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
  amenities: z.array(z.string().trim().min(1).max(40)).max(60).default([]),
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

const feedSource = z.enum(["AIRBNB", "BOOKING", "KAZDERNI", "OTHER"]);

export const calendarQuery = z
  .object({ from: isoDate, to: isoDate, roomId: id.optional() })
  .refine(({ from, to }) => to > from, { message: "`to` must be after `from`", path: ["to"] });

export const blockInput = z
  .object({
    roomId: id,
    source: feedSource.nullish(),
    note: z.string().trim().max(200).nullish(),
  })
  .and(stayDates);

export const feedInput = z.object({ roomId: id, url: z.url().max(2000), source: feedSource });

export const workspaceParams = z.object({ businessId: id });
export const blockParams = workspaceParams.extend({ blockId: id });
export const feedParams = workspaceParams.extend({ feedId: id });
export const roomParams = workspaceParams.extend({ roomId: id });
export const bookingParams = workspaceParams.extend({ bookingId: id });
export const roleParams = workspaceParams.extend({ roleId: id });
export const memberParams = workspaceParams.extend({ membershipId: id });
