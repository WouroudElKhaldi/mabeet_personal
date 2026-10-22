import type { BookingStatus } from "@prisma/client";
import { clsx } from "clsx";
import { Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import { formatSessionTime } from "@/lib/zoned-time";
import { can, type TenantContext } from "@/server/auth/tenant-context";
import { BookingActions } from "./booking-actions";

const STATUS_STYLE: Record<BookingStatus, string> = {
  HELD: "bg-warning/15 text-warning",
  AWAITING_PAYMENT: "bg-warning/15 text-warning",
  CONFIRMED: "bg-success/15 text-success",
  DECLINED: "bg-surface-2 text-muted",
  EXPIRED: "bg-surface-2 text-muted",
  CANCELLED: "bg-danger/10 text-danger",
};

export interface SessionBookingRowData {
  id: string;
  reference: string;
  status: BookingStatus;
  guestName: string;
  guestPhone: string;
  seats: number;
  totalCents: number;
  depositCents: number;
  currency: string;
  offering: { title: string };
  session: { startsAt: Date };
}

/** A booking for seats in an experience or service session, in the team's inbox. */
export async function SessionBookingRow({
  ctx,
  booking,
  timezone,
}: {
  ctx: TenantContext;
  booking: SessionBookingRowData;
  timezone: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.bookings"), getLocale()]);
  const showContact = can(ctx, "guests.contact");
  return (
    <li className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold">{booking.guestName}</p>
          <span
            className={clsx("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[booking.status])}
          >
            {t(`status.${booking.status}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {booking.offering.title} · {formatSessionTime(booking.session.startsAt, locale, timezone)} ·{" "}
          {t("guests", { count: booking.seats })} · {booking.reference}
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
          kind="session"
        />
      </div>
    </li>
  );
}
