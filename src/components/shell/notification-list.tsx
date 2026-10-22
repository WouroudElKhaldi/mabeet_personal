import { clsx } from "clsx";
import {
  BellOff,
  CalendarCheck,
  CalendarX2,
  CreditCard,
  Inbox,
  Landmark,
  type LucideIcon,
  Star,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export interface NotificationItem {
  id: string;
  action: string;
  userId: string | null;
  createdAt: Date;
  user: { name: string } | null;
  business: { id: string; name: string } | null;
  booking: { reference: string; guestName: string } | null;
}

const ICONS: Record<string, LucideIcon> = {
  "booking.requested": Inbox,
  "booking.confirmed": CalendarCheck,
  "booking.awaiting_payment": CreditCard,
  "booking.declined": CalendarX2,
  "booking.cancelled": CalendarX2,
  "booking.cancelled_by_guest": CalendarX2,
  "payment.recorded": CreditCard,
  "payment.online_confirmed": CreditCard,
  "payment.online_late": CreditCard,
  "review.submitted": Star,
  "payout.requested": Landmark,
  "member.added": UsersRound,
  "member.removed": UsersRound,
  "member.role_changed": UsersRound,
};

/** Where a notification leads: the bookings, payouts or team page of its business. */
function hrefFor(item: NotificationItem, admin: boolean): string | null {
  const businessId = item.business?.id;
  if (!businessId) return null;
  if (item.action === "payout.requested") return admin ? "/admin/money" : `/dashboard/${businessId}/payouts`;
  if (item.action.startsWith("member.")) return `/dashboard/${businessId}/team`;
  if (item.action === "review.submitted") return `/dashboard/${businessId}/reviews`;
  return `/dashboard/${businessId}/bookings?tab=all`;
}

/** The bell's list: newest first, unread ones marked, each linking to where to act. */
export async function NotificationList({
  items,
  seenAt,
  viewerId,
  admin = false,
}: {
  items: NotificationItem[];
  seenAt: Date | null;
  viewerId: string;
  admin?: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("notifications"), getLocale()]);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const ago = (date: Date) => {
    const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };

  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-xl bg-surface px-6 py-16 text-center ring-1 ring-line">
        <BellOff className="size-8 text-faint" aria-hidden />
        <p className="text-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      {items.map((item) => {
        const Icon = ICONS[item.action] ?? Inbox;
        const unread = (!seenAt || item.createdAt > seenAt) && item.userId !== viewerId;
        const href = hrefFor(item, admin);
        const text = t(`actions.${item.action.replace(".", "_")}` as "actions.booking_requested", {
          actor: item.user?.name ?? t("someone"),
          guest: item.booking?.guestName ?? t("aGuest"),
          reference: item.booking?.reference ?? "",
        });
        const body = (
          <>
            <span
              className={clsx(
                "grid size-9 shrink-0 place-items-center rounded-full",
                unread ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className={clsx("block text-sm", unread && "font-semibold")}>{text}</span>
              <span className="block text-xs text-muted">
                {admin && item.business ? `${item.business.name} · ` : ""}
                {ago(item.createdAt)}
              </span>
            </span>
            {unread && <span className="size-2 shrink-0 rounded-full bg-glow" aria-label={t("unread")} />}
          </>
        );
        return (
          <li key={item.id}>
            {href ? (
              <Link
                href={href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
