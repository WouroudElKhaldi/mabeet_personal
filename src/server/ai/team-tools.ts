import { z } from "zod";
import { ANALYTICS_SCOPES, BLOCK_SOURCES, BOOKING_STATUSES } from "@/config/enums";
import { addDays, parseIsoDate, rangesOverlap, toDateRange, toIsoDate, todayUtc } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { can, type TenantContext } from "@/server/auth/tenant-context";
import { getAnalytics, getBusinessReport } from "@/server/services/analytics-service";
import { getBusinessNotifications } from "@/server/services/notification-feed-service";
import { getPayouts } from "@/server/services/payout-service";
import { getBookingSetup } from "@/server/services/settings-service";
import {
  cancelBooking,
  confirmBooking,
  declineBooking,
  getBookingByReference,
  listBookings,
} from "@/server/services/booking-service";
import { addBlock, getCalendarBoard, getChannelSetup, removeBlock } from "@/server/services/calendar-service";
import { getSchedule } from "@/server/services/offering-service";
import { listReviewsForTeam } from "@/server/services/review-service";
import { listSessionBookings } from "@/server/services/session-booking-service";
import { findRoomByNameOrId, listRooms } from "@/server/services/room-service";
import { listMyPlaces, resolvePlaceContext } from "@/server/services/team-service";
import { type AiTool, defineTool } from "./tool";

// Tools for owners and staff. Each one calls the same service the dashboard uses,
// so the member's permissions and the tenant boundary are enforced exactly once, in the service layer.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const reference = z
  .string()
  .regex(/^[A-Z0-9-]{4,20}$/i)
  .describe("Booking reference, e.g. SN-7KX3P9");

const inEachCurrency = (amounts: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(amounts).map(([currency, cents]) => [currency, formatMoney(cents, currency, "en-US")]),
  );

/** Marks text written by strangers, so the model treats it as data and never as instructions. */
const guestWritten = (text: string | null) => (text ? { guestWritten: text } : null);

const defaultWindow = () => ({ checkIn: addDays(todayUtc(), -30), checkOut: addDays(todayUtc(), 1) });

const team = <Input extends z.ZodObject>(tool: AiTool<Input, TenantContext>) => defineTool(tool);

const SINGLE_PLACE_TOOLS = [
  team({
    name: "list_rooms",
    description: "The business's rooms with capacity, nightly base rate and amenities.",
    input: z.object({}),
    requires: "rooms.read",
    mutates: false,
    run: async (_input, ctx) =>
      (await listRooms(ctx)).map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        currency: room.business.currency,
        baseRateCents: room.baseRateCents,
        amenities: room.amenities,
        /** ROOM, or the single unit used when the place is booked as a whole. */
        kind: room.kind,
        active: room.active,
      })),
  }),
  team({
    name: "get_booking_setup",
    description:
      "How guests book and pay here: by room or the whole place, request or instant booking, paid to the host or online through Mabeet (deposit or full), deposit %, how long requests are held, and the refund policy.",
    input: z.object({}),
    requires: "bookings.read",
    mutates: false,
    run: (_input, ctx) => getBookingSetup(ctx),
  }),
  team({
    name: "get_analytics",
    description:
      "Analytics for a period from the database: occupancy, nights sold, direct revenue and commission saved per currency, requests by outcome, response time, rating, nights and revenue by month, channels, and a per-place breakdown. scope 'all' covers every place the member can see (only in the dashboard assistant, not through an AI key).",
    input: z.object({ from: isoDate, to: isoDate, scope: z.enum(ANALYTICS_SCOPES).default("place") }),
    requires: "analytics.read",
    mutates: false,
    run: async ({ from, to, scope }, ctx) => {
      const data = await getAnalytics(ctx, scope, toDateRange({ checkIn: from, checkOut: to }));
      const { revenue, commissionSaved, revenueCurrency, revenueByMonth, ...totals } = data.totals;
      return {
        range: data.range,
        totals: {
          ...totals,
          // Keyed by currency, so the money is formatted here rather than by the `...Cents` rule.
          revenue: inEachCurrency(revenue),
          commissionSaved: inEachCurrency(commissionSaved),
          revenueByMonth: revenueByMonth.map(({ month, cents }) => ({
            month,
            revenue: formatMoney(cents, revenueCurrency, "en-US"),
          })),
        },
        places: data.places.map((place) => ({
          name: place.name,
          currency: place.report.currency,
          occupancyRate: place.report.occupancyRate,
          nightsSold: place.report.nightsSold,
          directRevenueCents: place.report.directRevenueCents,
          commissionSavedCents: place.report.commissionSavedCents,
          rating: place.report.rating,
        })),
      };
    },
  }),
  team({
    name: "get_payouts",
    description:
      "Money guests paid online through Mabeet for this business: available to pay out, upcoming (stays not started yet), already paid out and requested, plus recent payouts. Owners only. Mabeet takes no commission.",
    input: z.object({}),
    requires: "analytics.read",
    mutates: false,
    run: async (_input, ctx) => {
      const data = await getPayouts(ctx);
      return {
        balances: data.balances,
        payouts: data.payouts.slice(0, 10).map((payout) => ({
          amountCents: payout.amountCents,
          currency: payout.currency,
          method: payout.method,
          status: payout.status,
          requestedAt: payout.createdAt,
          decidedAt: payout.decidedAt,
        })),
      };
    },
  }),
  team({
    name: "list_notifications",
    description:
      "The latest things that happened in the business: requests, confirmations, cancellations, payments, payouts, reviews, team changes.",
    input: z.object({}),
    requires: "bookings.read",
    mutates: false,
    run: async (_input, ctx) => {
      const { items } = await getBusinessNotifications(ctx, 1);
      return items.map((item) => ({
        what: item.action,
        when: item.createdAt,
        by: item.user?.name ?? null,
        booking: item.booking
          ? { reference: item.booking.reference, guest: guestWritten(item.booking.guestName) }
          : null,
      }));
    },
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
      status: z.enum(BOOKING_STATUSES).optional(),
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
        guestName: guestWritten(booking.guestName),
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
        guestName: guestWritten(booking.guestName),
        guestPhone: booking.guestPhone,
        guestEmail: booking.guestEmail,
        guestNote: guestWritten(booking.guestNote),
        currency: booking.currency,
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
        about: review.subject,
        comment: guestWritten(review.comment),
        ownerReply: review.ownerReply,
        hidden: review.status === "HIDDEN",
        date: toIsoDate(review.createdAt),
      })),
  }),
  team({
    name: "get_schedule",
    description:
      "Upcoming sessions of the business's experiences and services, with spots booked and capacity. Defaults to the next 14 days.",
    input: z.object({ days: z.number().int().min(1).max(90).default(14) }),
    requires: "bookings.read",
    mutates: false,
    run: async ({ days }, ctx) => {
      const now = new Date();
      return (await getSchedule(ctx, now, addDays(now, days))).map((session) => ({
        offering: session.offering.title,
        kind: session.offering.kind,
        startsAt: session.startsAt,
        booked: session.seatsTaken,
        capacity: session.capacity,
      }));
    },
  }),
  team({
    name: "list_experience_bookings",
    description:
      "Bookings for experiences and services (seats in a session), filtered by status. HELD means waiting for the owner.",
    input: z.object({ status: z.enum(BOOKING_STATUSES).optional() }),
    requires: "bookings.read",
    mutates: false,
    run: async ({ status }, ctx) =>
      (await listSessionBookings(ctx, { status, take: 50 })).map((booking) => ({
        reference: booking.reference,
        status: booking.status,
        offering: booking.offering.title,
        startsAt: booking.session.startsAt,
        guests: booking.seats,
        guestName: guestWritten(booking.guestName),
        guestPhone: booking.guestPhone,
        totalCents: booking.totalCents,
        currency: booking.currency,
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
    name: "cancel_booking",
    description:
      "Cancel a confirmed booking or a waiting request. If the guest paid online, they are refunded in full. Ask the user before calling this.",
    input: z.object({ reference, reason: z.string().max(300).optional() }),
    requires: "bookings.decide",
    mutates: true,
    run: async ({ reference: ref, reason }, ctx) => {
      const booking = await getBookingByReference(ctx, ref);
      const cancelled = await cancelBooking(ctx, { bookingId: booking.id, reason });
      return { reference: ref, status: cancelled.status };
    },
  }),
  team({
    name: "close_dates",
    description:
      "Block nights in one room (maintenance, or a booking taken by phone or on Kazderni). checkOut is the morning after the last closed night.",
    input: z.object({
      room: z.string().max(80).describe("The room's name (as list_rooms shows it) or its id"),
      checkIn: isoDate,
      checkOut: isoDate,
      source: z.enum(BLOCK_SOURCES).optional(),
      note: z.string().max(200).optional(),
    }),
    requires: "blocks.manage",
    mutates: true,
    run: async ({ room, checkIn, checkOut, source, note }, ctx) => {
      const target = await findRoomByNameOrId(ctx, room);
      const block = await addBlock(ctx, {
        roomId: target.id,
        range: toDateRange({ checkIn, checkOut }),
        source: source ?? null,
        note: note ?? null,
      });
      return { blockId: block.id, room: target.name, checkIn, checkOut };
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

/** The optional argument every place-specific tool gains, so an AI can work in any of the member's places. */
const placeArgument = z
  .string()
  .max(80)
  .optional()
  .describe(
    "Which of the member's places this is about: its name, part of its name, or its id (list_places shows them). Leave out for the current place.",
  );

/**
 * Every team tool works in any of the member's places: it takes an optional `place`, and runs as the member in
 * that place, with their role there. Without it, the place that holds the booking `reference` (if the tool takes
 * one), else the place of the key, token or dashboard.
 */
function inAnyPlace(tool: AiTool<z.ZodObject, TenantContext>): AiTool<z.ZodObject, TenantContext> {
  return {
    ...tool,
    input: tool.input.extend({ place: placeArgument }),
    run: async (input, ctx) => {
      const { place, ...rest } = input as { place?: string; reference?: string };
      return tool.run(rest, await resolvePlaceContext(ctx, place, rest.reference));
    },
  };
}

const TEAM_TOOLS = [
  team({
    name: "list_places",
    description:
      "The member's places (businesses), with their role in each and which one is current. Use a place's name in any other tool's `place` to ask about it.",
    input: z.object({}),
    mutates: false,
    run: (_input, ctx) => listMyPlaces(ctx),
  }),
  ...SINGLE_PLACE_TOOLS.map(inAnyPlace),
];

/** Only the tools this member's permissions allow; their AI never learns the others exist. */
export function teamToolsFor(ctx: TenantContext) {
  return TEAM_TOOLS.filter((tool) => !tool.requires || can(ctx, tool.requires));
}
