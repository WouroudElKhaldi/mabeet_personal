import ical, { type CalendarComponent, type DateWithTimeZone, type VEvent } from "node-ical";
import { addDays, type DateRange, parseIsoDate } from "@/lib/dates";

export interface FeedEvent extends DateRange {
  uid: string;
}

export interface ParseWindow {
  from: Date;
  to: Date;
  timezone: string;
}

/** All-day values come back as local midnight; read their calendar date, not their UTC instant. */
function dateOnlyToUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Date-times (the odd feed sends them) become the calendar date at the property. */
function dateTimeToPropertyDate(date: Date, timezone: string): Date {
  return parseIsoDate(new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date));
}

function toNight(value: DateWithTimeZone, timezone: string): Date {
  return value.dateOnly ? dateOnlyToUtc(value) : dateTimeToPropertyDate(value, timezone);
}

function isEvent(component: CalendarComponent | undefined): component is VEvent {
  return component?.type === "VEVENT";
}

function toFeedEvent(event: VEvent, timezone: string): FeedEvent | null {
  if (!event.uid || !event.start || event.status === "CANCELLED") return null;
  const checkIn = toNight(event.start, timezone);
  // A missing DTEND on an all-day event means a single night.
  const checkOut = event.end ? toNight(event.end, timezone) : addDays(checkIn, 1);
  return checkOut > checkIn ? { uid: event.uid, checkIn, checkOut } : null;
}

/** Parses an Airbnb / Booking.com / Kazderni .ics feed into night ranges inside the window. */
export function parseFeed(icsText: string, { from, to, timezone }: ParseWindow): FeedEvent[] {
  return Object.values(ical.sync.parseICS(icsText))
    .filter(isEvent)
    .map((event) => toFeedEvent(event, timezone))
    .filter((event): event is FeedEvent => event !== null && event.checkOut > from && event.checkIn < to);
}
