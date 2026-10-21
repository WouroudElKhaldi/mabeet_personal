"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { takenNights } from "@/lib/calendar-grid";
import { addDays, toIsoDate, todayUtc } from "@/lib/dates";
import type { quoteRoom } from "@/server/services/directory-service";

export type RoomQuote = Awaited<ReturnType<typeof quoteRoom>>;

const CALENDAR_DAYS = 365;

/** Taken nights of a room for the next year, for greying out the date picker. */
export function useTakenNights(slug: string, roomId: string): ReadonlySet<string> {
  const [taken, setTaken] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const controller = new AbortController();
    const from = todayUtc();
    const query = new URLSearchParams({ from: toIsoDate(from), to: toIsoDate(addDays(from, CALENDAR_DAYS)) });
    api
      .get<Array<{ checkIn: string; checkOut: string }>>(
        `/api/public/places/${slug}/rooms/${roomId}/availability?${query}`,
        controller.signal,
      )
      .then((ranges) => setTaken(takenNights(ranges)))
      .catch(() => setTaken(new Set()));
    return () => controller.abort();
  }, [slug, roomId]);
  return taken;
}

/** Live price for the chosen stay; null until both dates are picked. */
export function useRoomQuote(slug: string, roomId: string, checkIn: string | null, checkOut: string | null) {
  const [quote, setQuote] = useState<RoomQuote | null>(null);
  useEffect(() => {
    if (!checkIn || !checkOut) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    api
      .get<RoomQuote>(
        `/api/public/places/${slug}/rooms/${roomId}/quote?${new URLSearchParams({ checkIn, checkOut })}`,
        controller.signal,
      )
      .then(setQuote)
      .catch(() => setQuote(null));
    return () => controller.abort();
  }, [slug, roomId, checkIn, checkOut]);
  return quote;
}
