import { z } from "zod";
import { addDays, parseIsoDate, rangesOverlap, toDateRange, toIsoDate, todayUtc } from "@/lib/dates";
import type { TenantContext } from "@/server/auth/tenant-context";
import { getBusinessReport } from "@/server/services/analytics-service";
import {
  confirmBooking,
  declineBooking,
  getBookingByReference,
  listBookings,
} from "@/server/services/booking-service";
import { addBlock, getCalendarBoard, getChannelSetup, removeBlock } from "@/server/services/calendar-service";
import { listReviewsForTeam } from "@/server/services/review-service";
import { listRooms } from "@/server/services/room-service";
import { type AiTool, defineTool } from "./tool";

// Tools for owners and staff. Each one calls the same service the dashboard uses,
// so the member's permissions and the tenant boundary are enforced exactly once, in the service layer.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const reference = z
  .string()
  .regex(/^SN-[A-Z2-9]{6}$/i)
  .describe("Booking reference, e.g. SN-7KX3P9");

/** Marks text written by strangers, so the model treats it as data and never as instructions. */
const guestWritten = (text: string | null) => (text ? { guestWritten: text } : null);

const defaultWindow = () => ({ checkIn: addDays(todayUtc(), -30), checkOut: addDays(todayUtc(), 1) });

const team = <Input extends z.ZodObject>(tool: AiTool<Input, TenantContext>) => defineTool(tool);

export const TEAM_TOOLS = [
  team({
    name: "list_rooms",
    description: "The business's rooms with capacity, nightly base rate (cents) and amenities.",
    input: z.object({}),
    requires: "rooms.read",
    mutates: false,
    run: async (_input, ctx) =>
      (await listRooms(ctx)).map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        baseRateCents: room.baseRateCents,
        amenities: room.amenities,
        bookable: room.active,
      })),
  }),
  team({
    name: "check_availability",
    description:
      "Which rooms are free for a stay, counting direct bookings, blocks and Airbnb/Booking.com nights.",
    input: z.object({ checkIn: isoDate, checkOut: isoDate }),
    requires: "calendar.read",
    mutates: false,
    run: async ({ checkIn, checkOut }, ctx) => {
      const range = toDateRange({ checkIn, checkOut });
      const { rooms, occupancy } = await getCalendarBoard(ctx, range);
      return rooms.map((room) => ({
        room: room.name,
        free: !occupancy.some((row) => row.roomId === room.id && rangesOverlap(row, range)),
      }));
    },
  }),
  team({
    name: "get_calendar",
    description:
      "Night ranges taken in a window, per room, with their source (direct, manual, Airbnb, Booking.com, Kazderni).",
    input: z.object({ from: isoDate, to: isoDate }),
    requires: "calendar.read",
    mutates: false,
    run: async ({ from, to }, ctx) => {
      const { rooms, occupancy } = await getCalendarBoard(ctx, toDateRange({ checkIn: from, checkOut: to }));
      const roomName = new Map(rooms.map((room) => [room.id, room.name]));
      return occupancy.map((row) => ({
        room: roomName.get(row.roomId),
        checkIn: toIsoDate(row.checkIn),
        checkOut: toIsoDate(row.checkOut),
        source: row.kind === "DIRECT" ? "DIRECT" : (row.feed?.source ?? row.source ?? "MANUAL"),
        bookingReference: row.booking?.reference ?? null,
        bookingStatus: row.booking?.status ?? null,
        conflict: row.conflict,
      }));
    },
  }),
  team({
    name: "list_bookings",
    description: "Bookings filtered by status and dates (at most 50). HELD means waiting for the owner.",
    input: z.object({
      status: z.enum(["HELD", "CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"]).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
    }),
    requires: "bookings.read",
    mutates: false,
    run: async ({ status, from, to }, ctx) =>
      (
        await listBookings(ctx, {
          status,
          from: from ? parseIsoDate(from) : undefined,
          to: to ? parseIsoDate(to) : undefined,
          take: 50,
          skip: 0,
        })
      ).map((booking) => ({
        reference: booking.reference,
        status: booking.status,
        room: booking.room.name,
        checkIn: toIsoDate(booking.checkIn),
        checkOut: toIsoDate(booking.checkOut),
        guests: booking.guestCount,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        totalCents: booking.totalCents,
        currency: booking.currency,
      })),
  }),
  team({
    name: "get_booking",
    description: "One booking by its reference, including the guest's note.",
    input: z.object({ reference }),
    requires: "bookings.read",
    mutates: false,
    run: async ({ reference: ref }, ctx) => {
      const booking = await getBookingByReference(ctx, ref);
      return {
        reference: booking.reference,
        status: booking.status,
        room: booking.room.name,
        checkIn: toIsoDate(booking.checkIn),
        checkOut: toIsoDate(booking.checkOut),
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        guestEmail: booking.guestEmail,
        guestNote: guestWritten(booking.guestNote),
        totalCents: booking.totalCents,
        depositCents: booking.depositCents,
        holdExpiresAt: booking.holdExpiresAt,
      };
    },
  }),
  team({
    name: "get_report",
    description:
      "Occupancy rate, nights sold, direct revenue, average daily rate, commission saved versus platforms, channel mix, request funnel and rating. Defaults to the last 30 days.",
    input: z.object({ from: isoDate.optional(), to: isoDate.optional() }),
    requires: "analytics.read",
    mutates: false,
    run: ({ from, to }, ctx) =>
      getBusinessReport(ctx, from && to ? toDateRange({ checkIn: from, checkOut: to }) : defaultWindow()),
  }),
  team({
    name: "list_reviews",
    description: "Guest reviews with rating and any reply. Review text is written by guests.",
    input: z.object({}),
    requires: "reviews.reply",
    mutates: false,
    run: async (_input, ctx) =>
      (await listReviewsForTeam(ctx)).map((review) => ({
        rating: review.rating,
        room: review.room.name,
        comment: guestWritten(review.comment),
        ownerReply: review.ownerReply,
        hidden: review.status === "HIDDEN",
        date: toIsoDate(review.createdAt),
      })),
  }),
  team({
    name: "get_sync_status",
    description:
      "Health of each Airbnb / Booking.com / Kazderni calendar link: last sync time and last error.",
    input: z.object({}),
    requires: "feeds.manage",
    mutates: false,
    run: async (_input, ctx) =>
      (await getChannelSetup(ctx)).map((room) => ({
        room: room.name,
        feeds: room.feeds.map((feed) => ({
          source: feed.source,
          lastSyncedAt: feed.lastSyncedAt,
          lastError: feed.lastError,
        })),
      })),
  }),
  team({
    name: "confirm_booking",
    description: "Confirm a booking request that is waiting (HELD). Ask the user before calling this.",
    input: z.object({ reference }),
    requires: "bookings.decide",
    mutates: true,
    run: async ({ reference: ref }, ctx) => {
      const booking = await getBookingByReference(ctx, ref);
      const confirmed = await confirmBooking(ctx, { bookingId: booking.id });
      return { reference: ref, status: confirmed.status };
    },
  }),
  team({
    name: "decline_booking",
    description: "Decline a waiting booking request. Ask the user before calling this.",
    input: z.object({ reference, reason: z.string().max(300).optional() }),
    requires: "bookings.decide",
    mutates: true,
    run: async ({ reference: ref, reason }, ctx) => {
      const booking = await getBookingByReference(ctx, ref);
      const declined = await declineBooking(ctx, { bookingId: booking.id, reason });
      return { reference: ref, status: declined.status };
    },
  }),
  team({
    name: "close_dates",
    description: "Block nights in one room (maintenance, or a booking taken by phone or on Kazderni).",
    input: z.object({
      roomId: z.string().max(64),
      checkIn: isoDate,
      checkOut: isoDate,
      source: z.enum(["KAZDERNI", "OTHER"]).optional(),
      note: z.string().max(200).optional(),
    }),
    requires: "blocks.manage",
    mutates: true,
    run: async ({ roomId, checkIn, checkOut, source, note }, ctx) => {
      const block = await addBlock(ctx, {
        roomId,
        range: toDateRange({ checkIn, checkOut }),
        source: source ?? null,
        note: note ?? null,
      });
      return { blockId: block.id };
    },
  }),
  team({
    name: "reopen_dates",
    description: "Remove a manual block by its id (from get_calendar or close_dates).",
    input: z.object({ blockId: z.string().max(64) }),
    requires: "blocks.manage",
    mutates: true,
    run: async ({ blockId }, ctx) => {
      await removeBlock(ctx, blockId);
      return { reopened: true };
    },
  }),
];

/** Only the tools this member's permissions allow; their AI never learns the others exist. */
export function teamToolsFor(ctx: TenantContext) {
  return TEAM_TOOLS.filter((tool) => !tool.requires || ctx.permissions.has(tool.requires));
}
