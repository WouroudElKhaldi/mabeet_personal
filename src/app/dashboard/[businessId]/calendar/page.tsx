import { getTranslations } from "next-intl/server";
import { BlockForm } from "@/components/dashboard/block-form";
import { CalendarBoard, type CalendarEntry } from "@/components/dashboard/calendar-board";
import { addDays, parseIsoDate, toIsoDate, todayUtc } from "@/lib/dates";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { getCalendarBoard } from "@/server/services/calendar-service";

type PageProps = { params: Promise<{ businessId: string }>; searchParams: Promise<{ month?: string }> };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const requested = (await searchParams).month;
  const month = requested && MONTH.test(requested) ? requested : toIsoDate(todayUtc()).slice(0, 7);
  const ctx = await requirePageAccess(businessId, ["calendar.read"]);
  const from = parseIsoDate(`${month}-01`);
  const range = { checkIn: from, checkOut: addDays(from, 32) };
  const [t, { rooms, occupancy }] = await Promise.all([
    getTranslations("dashboard.calendar"),
    getCalendarBoard(ctx, range),
  ]);

  const entries: CalendarEntry[] = occupancy.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    checkIn: toIsoDate(row.checkIn),
    checkOut: toIsoDate(row.checkOut),
    kind: row.kind,
    conflict: row.conflict,
    pending: row.booking?.status === "HELD",
    label: row.booking?.guestName ?? row.note ?? t(`sources.${row.source ?? row.feed?.source ?? "NONE"}`),
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="rise-in text-4xl font-semibold">{t("title")}</h1>
      <CalendarBoard
        businessId={businessId}
        month={month}
        rooms={rooms}
        entries={entries}
        canEditBlocks={can(ctx, "blocks.manage")}
      />
      {can(ctx, "blocks.manage") && rooms.length > 0 && <BlockForm businessId={businessId} rooms={rooms} />}
    </div>
  );
}
