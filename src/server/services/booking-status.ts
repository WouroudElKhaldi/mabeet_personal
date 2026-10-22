import type { BookingStatus } from "@prisma/client";
import { conflict } from "@/server/errors";

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  HELD: ["CONFIRMED", "AWAITING_PAYMENT", "DECLINED", "EXPIRED", "CANCELLED"],
  // The guest pays and it is confirmed, or they never pay and it expires; either side may still cancel.
  AWAITING_PAYMENT: ["CONFIRMED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

/** How a status reads inside an error message. */
const word = (status: BookingStatus) =>
  status === "AWAITING_PAYMENT" ? "pending payment" : status.toLowerCase();

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(`A ${word(from)} booking cannot become ${word(to)}`);
  }
}
