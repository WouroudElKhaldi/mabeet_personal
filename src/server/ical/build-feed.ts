import ical from "ical-generator";
import { BRAND } from "@/config/brand";
import type { DateRange } from "@/lib/dates";

export interface ExportEvent extends DateRange {
  id: string;
}

/**
 * Platforms track exported events by UID. Changing this suffix would make every block look deleted and
 * re-created on Airbnb and Booking.com, so it stays as it was when the first feeds were published.
 */
const EVENT_UID_DOMAIN = "se-next-stays";

/**
 * Our availability for Airbnb and Booking.com to import. Neutral summaries only:
 * no guest name, phone or email ever leaves through this feed.
 */
export function buildExportFeed(calendarName: string, events: readonly ExportEvent[]): string {
  const calendar = ical({
    name: calendarName,
    prodId: { company: BRAND.name, product: "availability" },
  });
  for (const event of events) {
    calendar.createEvent({
      id: `${event.id}@${EVENT_UID_DOMAIN}`,
      start: event.checkIn,
      end: event.checkOut,
      allDay: true,
      summary: "Not available",
    });
  }
  return calendar.toString();
}
