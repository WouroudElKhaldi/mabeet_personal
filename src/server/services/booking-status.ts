import type { BookingStatus } from "@prisma/client";
import { conflict } from "@/server/errors";

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  HELD: ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(`A ${from.toLowerCase()} booking cannot become ${to.toLowerCase()}`);
  }
}
