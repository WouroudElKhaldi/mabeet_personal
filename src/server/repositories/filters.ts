import type { DateRange } from "@/lib/dates";

/** Prisma filter for rows whose [checkIn, checkOut) range overlaps `range`. */
export function overlapsRange(range: DateRange) {
  return { checkIn: { lt: range.checkOut }, checkOut: { gt: range.checkIn } };
}
