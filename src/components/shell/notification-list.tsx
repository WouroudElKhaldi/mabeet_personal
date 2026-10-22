"use client";

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
import { useLocale, useTranslations } from "next-intl";

export interface NotificationItem {
  id: string;
  action: string;
  userId: string | null;
  createdAt: Date | string;
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

/**
 * Notifications, newest first, unread ones marked, each linking to where to act. The full page and the bell's
 * dropdown both use it; `compact` is the dropdown's tighter version.
 */
export function NotificationList({
  items,
  seenAt,
  viewerId,
  admin = false,
  compact = false,
  onNavigate,
}: {
  items: NotificationItem[];
  seenAt: Date | string | null;
  viewerId: string;
  admin?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seen = seenAt ? new Date(seenAt) : null;
  const ago = (date: Date) => {
    const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };

  if (items.length === 0) {
    return (
      <div
        className={clsx(
          "grid place-items-center gap-3 text-center",
          compact ? "px-4 py-8" : "rounded-xl bg-surface px-6 py-16 ring-1 ring-line",
        )}
      >
        <BellOff className={compact ? "size-6 text-faint" : "size-8 text-faint"} aria-hidden />
        <p className="text-sm text-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul
      className={clsx(
        "divide-y divide-line overflow-hidden",
        !compact && "rounded-xl bg-surface ring-1 ring-line",
      )}
    >
      {items.map((item) => {
        const Icon = ICONS[item.action] ?? Inbox;
        const at = new Date(item.createdAt);
        const unread = (!seen || at > seen) && item.userId !== viewerId;
        const href = hrefFor(item, admin);
        const text = t(`actions.${item.action.replace(".", "_")}` as "actions.booking_requested", {
          actor: item.user?.name ?? t("someone"),
          guest: item.booking?.guestName ?? t("aGuest"),
          reference: item.booking?.reference ?? "",
        });
        const row = clsx("flex items-center gap-3", compact ? "px-3 py-2.5" : "px-4 py-3");
        const body = (
          <>
            <span
              className={clsx(
                "grid shrink-0 place-items-center rounded-full",
                compact ? "size-8" : "size-9",
                unread ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className={clsx("block text-sm", compact && "line-clamp-2", unread && "font-semibold")}>
                {text}
              </span>
              <span className="block text-xs text-muted">
                {admin && item.business ? `${item.business.name} · ` : ""}
                {ago(at)}
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
                onClick={onNavigate}
                className={clsx(row, "transition-colors hover:bg-surface-2")}
              >
                {body}
              </Link>
            ) : (
              <div className={row}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
