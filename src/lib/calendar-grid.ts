import { addDays, parseIsoDate, toIsoDate } from "./dates";

export interface MonthCursor {
  year: number;
  month: number; // 0-11
}

export function monthOf(isoDate: string): MonthCursor {
  const date = parseIsoDate(isoDate);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function shiftMonth({ year, month }: MonthCursor, delta: number): MonthCursor {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/** ISO dates for a month view, padded with nulls so the first row starts on `weekStartsOn` (0 = Sunday). */
export function monthGrid({ year, month }: MonthCursor, weekStartsOn = 1): Array<string | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => toIsoDate(addDays(first, index)));
  return [...Array<null>(lead).fill(null), ...days];
}

/** Every night (ISO date) covered by half-open ranges, for marking a calendar as taken. */
export function takenNights(ranges: ReadonlyArray<{ checkIn: string; checkOut: string }>): Set<string> {
  const nights = new Set<string>();
  for (const range of ranges) {
    for (
      let night = parseIsoDate(range.checkIn);
      night < parseIsoDate(range.checkOut);
      night = addDays(night, 1)
    ) {
      nights.add(toIsoDate(night));
    }
  }
  return nights;
}

/** True if any night in [checkIn, checkOut) is taken. */
export function rangeHitsTaken(checkIn: string, checkOut: string, taken: ReadonlySet<string>): boolean {
  for (let night = parseIsoDate(checkIn); night < parseIsoDate(checkOut); night = addDays(night, 1)) {
    if (taken.has(toIsoDate(night))) return true;
  }
  return false;
}
