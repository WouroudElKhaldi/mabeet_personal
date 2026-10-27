import { getTranslations } from "next-intl/server";
import { CalendarBoard } from "@/components/dashboard/calendar-board";
import type { CalendarEntry } from "@/components/dashboard/calendar-model";
import { PageHeader } from "@/components/shell/page-header";
import { addDays, parseIsoDate, toIsoDate, todayUtc } from "@/lib/dates";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { getCalendar, getCalendarBoard } from "@/server/services/calendar-service";

type PageProps = { params: Promise<{ businessId: string }>; searchParams: Promise<{ month?: string }> };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const GRID_DAYS = 42; // six weeks: every month fits, with its neighbours' days around it

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const requested = (await searchParams).month;
  const today = todayUtc();
  const month = requested && MONTH.test(requested) ? requested : toIsoDate(today).slice(0, 7);
  const ctx = await requirePageAccess(businessId, ["calendar.read"]);
  const first = parseIsoDate(`${month}-01`);
  // The grid starts on the Monday on or before the 1st.
  const gridStart = addDays(first, -((first.getUTCDay() + 6) % 7));
  const [t, { rooms, occupancy }, comingUp] = await Promise.all([
    getTranslations("dashboard.calendar"),
    getCalendarBoard(ctx, { checkIn: gridStart, checkOut: addDays(gridStart, GRID_DAYS) }),
    getCalendar(ctx, { checkIn: today, checkOut: addDays(today, 8) }),
  ]);

  const toEntry = (row: (typeof occupancy)[number]): CalendarEntry => ({
    id: row.id,
    roomId: row.roomId,
    checkIn: toIsoDate(row.checkIn),
    checkOut: toIsoDate(row.checkOut),
    kind: row.kind,
    conflict: row.conflict,
    pending: row.booking?.status === "HELD" || row.booking?.status === "AWAITING_PAYMENT",
    reference: row.booking?.reference ?? null,
    label: row.booking?.guestName ?? row.note ?? t(`sources.${row.source ?? row.feed?.source ?? "NONE"}`),
  });

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <CalendarBoard
        businessId={businessId}
        month={month}
        gridStart={toIsoDate(gridStart)}
        today={toIsoDate(today)}
        rooms={rooms}
        entries={occupancy.map(toEntry)}
        comingUp={comingUp.map(toEntry)}
        canEditBlocks={can(ctx, "blocks.manage")}
      />
    </>
  );
}
