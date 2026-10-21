import ical from "ical-generator";
import type { DateRange } from "@/lib/dates";

export interface ExportEvent extends DateRange {
  id: string;
}

/**
 * Our availability for Airbnb and Booking.com to import. Neutral summaries only:
 * no guest name, phone or email ever leaves through this feed.
 */
export function buildExportFeed(calendarName: string, events: readonly ExportEvent[]): string {
  const calendar = ical({
    name: calendarName,
    prodId: { company: "SE-NEXT Stays", product: "availability" },
  });
  for (const event of events) {
    calendar.createEvent({
      id: `${event.id}@se-next-stays`,
      start: event.checkIn,
      end: event.checkOut,
      allDay: true,
      summary: "Not available",
    });
  }
  return calendar.toString();
}
