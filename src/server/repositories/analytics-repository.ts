import { Prisma } from "@prisma/client";
import type { DateRange } from "@/lib/dates";
import type { Db } from "@/server/db/client";

// Night-level reporting in raw SQL. Every query takes businessId as a parameter.
// A night counts as sold when it is a confirmed direct booking, a manual block or an imported platform booking.

const SOLD_NIGHT = `(o.kind <> 'DIRECT' OR b.status = 'CONFIRMED')`;

export type Channel = "DIRECT" | "AIRBNB" | "BOOKING" | "KAZDERNI" | "OTHER" | "MANUAL";

export interface ChannelNights {
  channel: Channel;
  nights: number;
}

export function soldNightsByChannel(db: Db, businessId: string, range: DateRange) {
  return db.$queryRawUnsafe<ChannelNights[]>(
    `SELECT CASE
              WHEN o.kind = 'DIRECT' THEN 'DIRECT'
              WHEN o.kind = 'IMPORTED' THEN COALESCE(f.source::text, 'OTHER')
              ELSE COALESCE(o.source::text, 'MANUAL')
            END AS channel,
            SUM(LEAST(o."checkOut", $3::date) - GREATEST(o."checkIn", $2::date))::int AS nights
     FROM "Occupancy" o
     LEFT JOIN "Booking" b ON b.id = o."bookingId"
     LEFT JOIN "CalendarFeed" f ON f.id = o."feedId"
     WHERE o."businessId" = $1 AND o.active AND o."checkIn" < $3::date AND o."checkOut" > $2::date
       AND ${SOLD_NIGHT}
     GROUP BY 1`,
    businessId,
    range.checkIn,
    range.checkOut,
  );
}

export interface MonthlyNights {
  month: string;
  nights: number;
}

export function soldNightsByMonth(db: Db, businessId: string, range: DateRange) {
  return db.$queryRawUnsafe<MonthlyNights[]>(
    `SELECT to_char(night, 'YYYY-MM') AS month, COUNT(*)::int AS nights
     FROM "Occupancy" o
     LEFT JOIN "Booking" b ON b.id = o."bookingId"
     CROSS JOIN LATERAL generate_series(
       GREATEST(o."checkIn", $2::date), LEAST(o."checkOut", $3::date) - 1, interval '1 day'
     ) AS night
     WHERE o."businessId" = $1 AND o.active AND o."checkIn" < $3::date AND o."checkOut" > $2::date
       AND ${SOLD_NIGHT}
     GROUP BY 1 ORDER BY 1`,
    businessId,
    range.checkIn,
    range.checkOut,
  );
}

/** Confirmed direct revenue, pro-rated by the nights that fall inside the range. */
export async function directRevenueCents(db: Db, businessId: string, range: DateRange): Promise<number> {
  const [row] = await db.$queryRawUnsafe<Array<{ cents: number | null }>>(
    `SELECT SUM(
              b."totalCents"::numeric
              * (LEAST(b."checkOut", $3::date) - GREATEST(b."checkIn", $2::date))
              / (b."checkOut" - b."checkIn")
            )::int AS cents
     FROM "Booking" b
     WHERE b."businessId" = $1 AND b.status = 'CONFIRMED' AND b."checkIn" < $3::date AND b."checkOut" > $2::date`,
    businessId,
    range.checkIn,
    range.checkOut,
  );
  return row?.cents ?? 0;
}

/** Every confirmed direct booking ever, stays and seats in sessions, by currency. */
export async function lifetimeDirectRevenue(db: Db, businessId: string) {
  return db.$queryRawUnsafe<Array<{ currency: string; cents: number }>>(
    `SELECT currency, SUM(cents)::int AS cents FROM (
       SELECT currency, "totalCents" AS cents FROM "Booking" WHERE "businessId" = $1 AND status = 'CONFIRMED'
       UNION ALL
       SELECT currency, "totalCents" FROM "SessionBooking" WHERE "businessId" = $1 AND status = 'CONFIRMED'
     ) direct GROUP BY currency`,
    businessId,
  );
}

export interface PlaceSnapshot {
  businessId: string;
  /** Requests waiting for an answer. */
  waiting: number;
  arrivingToday: number;
  leavingToday: number;
  /** Guests staying tonight. */
  inHouse: number;
  /** Confirmed direct revenue for stays starting this month. */
  monthRevenueCents: number;
}

/** Today at a glance for several places at once, for an owner's "all my places" screen. */
export function placeSnapshots(
  db: Db,
  businessIds: string[],
  today: Date,
  monthStart: Date,
  nextMonth: Date,
) {
  return db.$queryRaw<PlaceSnapshot[]>`
    SELECT b."businessId",
           COUNT(*) FILTER (WHERE b.status = 'HELD')::int AS waiting,
           COUNT(*) FILTER (WHERE b.status IN ('CONFIRMED', 'AWAITING_PAYMENT') AND b."checkIn" = ${today}::date)::int AS "arrivingToday",
           COUNT(*) FILTER (WHERE b.status = 'CONFIRMED' AND b."checkOut" = ${today}::date)::int AS "leavingToday",
           COUNT(*) FILTER (WHERE b.status = 'CONFIRMED' AND b."checkIn" <= ${today}::date AND b."checkOut" > ${today}::date)::int AS "inHouse",
           COALESCE(SUM(b."totalCents") FILTER (
             WHERE b.status = 'CONFIRMED' AND b."checkIn" >= ${monthStart}::date AND b."checkIn" < ${nextMonth}::date
           ), 0)::int AS "monthRevenueCents"
    FROM "Booking" b
    WHERE b."businessId" IN (${Prisma.join(businessIds)})
    GROUP BY b."businessId"`;
}

export interface MonthlyRevenue {
  month: string;
  cents: number;
  bookings: number;
}

/** Confirmed direct revenue by the month stays start, stays and seats in sessions together. */
export function revenueByMonth(db: Db, businessId: string, range: DateRange) {
  return db.$queryRawUnsafe<MonthlyRevenue[]>(
    `SELECT month, SUM(cents)::int AS cents, COUNT(*)::int AS bookings FROM (
       SELECT to_char("checkIn", 'YYYY-MM') AS month, "totalCents" AS cents FROM "Booking"
       WHERE "businessId" = $1 AND status = 'CONFIRMED' AND "checkIn" >= $2::date AND "checkIn" < $3::date
       UNION ALL
       SELECT to_char(s."startsAt", 'YYYY-MM'), sb."totalCents" FROM "SessionBooking" sb
       JOIN "OfferingSession" s ON s.id = sb."sessionId"
       WHERE sb."businessId" = $1 AND sb.status = 'CONFIRMED' AND s."startsAt" >= $2::date AND s."startsAt" < $3::date
     ) direct GROUP BY month ORDER BY month`,
    businessId,
    range.checkIn,
    range.checkOut,
  );
}

export function countActiveRooms(db: Db, businessId: string) {
  return db.room.count({ where: { businessId, active: true } });
}

export function bookingRequestsByStatus(db: Db, businessId: string, range: DateRange) {
  return db.booking.groupBy({
    by: ["status"],
    where: { businessId, createdAt: { gte: range.checkIn, lt: range.checkOut } },
    _count: { _all: true },
  });
}

export async function medianResponseMinutes(
  db: Db,
  businessId: string,
  range: DateRange,
): Promise<number | null> {
  const [row] = await db.$queryRawUnsafe<Array<{ minutes: number | null }>>(
    `SELECT (percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("decidedAt" - "createdAt")) / 60
            ))::int AS minutes
     FROM "Booking"
     WHERE "businessId" = $1 AND "decidedAt" IS NOT NULL AND "createdAt" >= $2::date AND "createdAt" < $3::date`,
    businessId,
    range.checkIn,
    range.checkOut,
  );
  return row?.minutes ?? null;
}

export function ratingSummary(db: Db, businessId: string) {
  return db.review.aggregate({
    where: { businessId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
}
