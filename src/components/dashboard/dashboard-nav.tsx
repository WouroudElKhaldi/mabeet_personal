"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV_ITEMS, type NavItem } from "./nav-items";

interface DashboardNavProps {
  businessId: string;
  allowed: ReadonlyArray<NavItem["key"]>;
}

function useActiveKey(base: string): NavItem["key"] {
  const pathname = usePathname();
  const rest = pathname.slice(base.length);
  return NAV_ITEMS.find((item) => item.path && rest.startsWith(item.path))?.key ?? "overview";
}

/** Sidebar on large screens. */
export function DashboardSidebar({ businessId, allowed }: DashboardNavProps) {
  const t = useTranslations("dashboard.nav");
  const base = `/dashboard/${businessId}`;
  const active = useActiveKey(base);
  return (
    <nav className="grid gap-0.5">
      {NAV_ITEMS.filter((item) => allowed.includes(item.key)).map(({ key, path, icon: Icon }) => (
        <Link
          key={key}
          href={`${base}${path}`}
          aria-current={active === key ? "page" : undefined}
          className={clsx(
            "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
            active === key ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          {active === key && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-md bg-surface shadow-soft ring-1 ring-line"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <Icon className="relative size-[1.1rem]" aria-hidden />
          <span className="relative">{t(key)}</span>
        </Link>
      ))}
    </nav>
  );
}

const MOBILE_KEYS: ReadonlyArray<NavItem["key"]> = [
  "overview",
  "bookings",
  "calendar",
  "assistant",
  "settings",
];

/** Thumb-reachable tab bar on phones, where most owners will use the app. */
export function DashboardTabBar({ businessId, allowed }: DashboardNavProps) {
  const t = useTranslations("dashboard.nav");
  const base = `/dashboard/${businessId}`;
  const active = useActiveKey(base);
  const items = NAV_ITEMS.filter((item) => MOBILE_KEYS.includes(item.key) && allowed.includes(item.key));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map(({ key, path, icon: Icon }) => (
          <Link
            key={key}
            href={`${base}${path}`}
            aria-current={active === key ? "page" : undefined}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold transition-colors",
              active === key ? "text-accent" : "text-muted",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {t(key)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
