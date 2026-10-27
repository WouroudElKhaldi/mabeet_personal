import { addDays, parseIsoDate, toIsoDate } from "@/lib/dates";

// The calendar's data and the pure date helpers its pieces share (board, side panel, close-dates form).
// Dates are ISO strings (YYYY-MM-DD) so they compare as text and render the same on the server and in the browser.

/** One taken night range on the calendar: a booking, a manual block or an imported platform stay. */
export interface CalendarEntry {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  kind: "DIRECT" | "MANUAL" | "IMPORTED";
  label: string;
  conflict: boolean;
  pending: boolean;
  /** For direct bookings: the booking reference. */
  reference: string | null;
}

export type EntryKind = CalendarEntry["kind"];

export const ENTRY_KINDS: EntryKind[] = ["DIRECT", "MANUAL", "IMPORTED"];

export const KIND_STYLE: Record<EntryKind, string> = {
  DIRECT: "bg-accent text-accent-ink",
  MANUAL: "bg-ink/80 text-paper",
  IMPORTED: "bg-glow/25 text-ink ring-1 ring-inset ring-glow/60",
};

/** Diagonal stripes over a stay that still waits for the host or for payment. */
export const PENDING_STYLE =
  "[background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.22)_6px_12px)]";

export const shiftDay = (iso: string, days: number) => toIsoDate(addDays(parseIsoDate(iso), days));

export const nightsBetween = (from: string, to: string) =>
  Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);

/** The night starting on `day` is part of the stay; the check-out day is free again. */
export const covers = (entry: CalendarEntry, day: string) => entry.checkIn <= day && day < entry.checkOut;

export const isWeekend = (day: string) => [0, 6].includes(parseIsoDate(day).getUTCDay());

/** Stacks stays into lanes, so a stay keeps its row from one day to the next. */
export function assignLanes(entries: CalendarEntry[]): Map<string, number> {
  const ends: string[] = [];
  const lanes = new Map<string, number>();
  for (const entry of [...entries].sort(
    (a, b) => a.checkIn.localeCompare(b.checkIn) || b.checkOut.localeCompare(a.checkOut),
  )) {
    let lane = ends.findIndex((end) => end <= entry.checkIn);
    if (lane === -1) lane = ends.push(entry.checkOut) - 1;
    else ends[lane] = entry.checkOut;
    lanes.set(entry.id, lane);
  }
  return lanes;
}
