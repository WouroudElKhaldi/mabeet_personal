import type { BookingStatus } from "@prisma/client";
import { clsx } from "clsx";
import { Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { can, type TenantContext } from "@/server/auth/tenant-context";
import { formatMoney, formatStayDates } from "@/lib/format";
import { BookingActions } from "./booking-actions";

const STATUS_STYLE: Record<BookingStatus, string> = {
  HELD: "bg-warning/15 text-warning",
  AWAITING_PAYMENT: "bg-warning/15 text-warning",
  CONFIRMED: "bg-success/15 text-success",
  DECLINED: "bg-surface-2 text-muted",
  EXPIRED: "bg-surface-2 text-muted",
  CANCELLED: "bg-danger/10 text-danger",
};

export interface BookingRowData {
  id: string;
  reference: string;
  status: BookingStatus;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  checkIn: Date;
  checkOut: Date;
  totalCents: number;
  depositCents: number;
  currency: string;
  room: { name: string };
}

export async function BookingRow({ ctx, booking }: { ctx: TenantContext; booking: BookingRowData }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.bookings"), getLocale()]);
  const showContact = can(ctx, "guests.contact");
  return (
    <li className="grid gap-4 rounded-lg bg-surface p-5 ring-1 ring-line sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-xl font-semibold">{booking.guestName}</p>
          <span
            className={clsx("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[booking.status])}
          >
            {t(`status.${booking.status}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {booking.room.name} · {formatStayDates(booking.checkIn, booking.checkOut, locale)} ·{" "}
          {t("guests", { count: booking.guestCount })} · {booking.reference}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Phone className="size-3.5 text-muted" aria-hidden />
          {showContact ? (
            <a
              href={`tel:${booking.guestPhone}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {booking.guestPhone}
            </a>
          ) : (
            <span className="text-muted">{booking.guestPhone}</span>
          )}
        </p>
      </div>
      <div className="grid gap-3 sm:justify-items-end">
        <p className="font-semibold tabular-nums">
          {formatMoney(booking.totalCents, booking.currency, locale)}
        </p>
        <BookingActions
          businessId={ctx.businessId}
          bookingId={booking.id}
          status={booking.status}
          depositCents={booking.depositCents}
          canDecide={can(ctx, "bookings.decide")}
          canRecordPayment={can(ctx, "payments.record")}
        />
      </div>
    </li>
  );
}
