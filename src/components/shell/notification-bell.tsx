"use client";

import { Bell, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { type NotificationItem, NotificationList } from "./notification-list";

interface Feed {
  items: NotificationItem[];
  seenAt: string | null;
}

/**
 * The bell: a red count of what's new, and on click a small card with the latest five and "View all". Opening it
 * marks them read; the card still shows which were new.
 */
export function NotificationBell({
  feedEndpoint,
  viewAllHref,
  unread,
  viewerId,
  admin = false,
}: {
  /** GET the latest five; POST to it marks everything read. */
  feedEndpoint: string;
  viewAllHref: string;
  unread: number;
  viewerId: string;
  admin?: boolean;
}) {
  const t = useTranslations("shell");
  const tNotify = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(unread), [unread]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !panel.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setFailed(false);
    try {
      setFeed(await api.get<Feed>(feedEndpoint));
      if (count > 0) {
        await api.post(feedEndpoint, {});
        setCount(0);
      }
    } catch {
      setFailed(true);
    }
  };

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => void toggle()}
        aria-label={count > 0 ? t("notificationsUnread", { count }) : t("notifications")}
        title={t("notifications")}
        className="relative grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="size-[1.1rem]" aria-hidden />
        {count > 0 && (
          <span className="absolute end-1 top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[0.625rem] leading-none font-bold text-danger-ink">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={tNotify("title")}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl bg-surface shadow-lift ring-1 ring-line sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-96"
          >
            <p className="border-b border-line px-4 py-3 font-semibold">{tNotify("title")}</p>
            {feed ? (
              <NotificationList
                items={feed.items}
                seenAt={feed.seenAt}
                viewerId={viewerId}
                admin={admin}
                compact
                onNavigate={() => setOpen(false)}
              />
            ) : failed ? (
              <p className="px-4 py-6 text-sm text-danger">{tNotify("failed")}</p>
            ) : (
              <p className="flex justify-center py-8" role="status">
                <LoaderCircle className="size-5 animate-spin text-muted" aria-label={tNotify("loading")} />
              </p>
            )}
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-accent hover:bg-surface-2"
            >
              {tNotify("viewAll")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
