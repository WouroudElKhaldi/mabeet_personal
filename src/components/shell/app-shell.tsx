"use client";

import { BackLink } from "./back-link";
import { clsx } from "clsx";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarRange,
  Compass,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquareQuote,
  MoreHorizontal,
  Palette,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { authClient } from "@/lib/auth-client";
import { NotificationBell } from "./notification-bell";

/** Icons by name, so server layouts can describe their navigation in plain data. */
const ICONS = {
  activity: Activity,
  bell: Bell,
  bot: Bot,
  building: Building2,
  calendar: CalendarRange,
  chart: BarChart3,
  compass: Compass,
  card: CreditCard,
  door: DoorOpen,
  inbox: Inbox,
  key: KeyRound,
  landmark: Landmark,
  dashboard: LayoutDashboard,
  quote: MessageSquareQuote,
  palette: Palette,
  sync: RefreshCw,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  tags: Tags,
  user: UserRound,
  users: UsersRound,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface ShellLink {
  href: string;
  label: string;
  icon: IconName;
  /** Only this exact path is "here" (for a section's home page). */
  exact?: boolean;
}

export interface ShellGroup {
  label: string;
  items: ShellLink[];
}

interface AppShellProps {
  /** What this area is: "Host dashboard" or "Platform admin". */
  area: string;
  /** Above the navigation: the business switcher, or the admin badge. */
  sidebarTop: ReactNode;
  groups: ShellGroup[];
  /** Up to four links for the phone's bottom bar; the rest live behind "More". */
  tabs: string[];
  /** Links in the user menu: account, admin, host dashboard… */
  userLinks: ShellLink[];
  /** A highlighted shortcut in the top bar, e.g. the AI assistant. */
  cta?: ShellLink;
  /** This area's notifications: the bell's card (feed API) and the full page. */
  notificationsHref: string;
  notificationsFeed: string;
  unread: number;
  profileHref: string;
  user: { id: string; name: string; email: string };
  /** The admin area, whose notifications link to admin pages. */
  admin?: boolean;
  children: ReactNode;
}

function useActive(groups: ShellGroup[]) {
  const pathname = usePathname();
  const all = groups.flatMap((group) => group.items);
  const matches = all.filter((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

/** The app frame for the host dashboard and the admin area: sidebar, top bar, phone drawer and tab bar. */
export function AppShell(props: AppShellProps) {
  const {
    area,
    sidebarTop,
    groups,
    tabs,
    user,
    userLinks,
    cta,
    notificationsHref,
    notificationsFeed,
    unread,
    profileHref,
    admin = false,
    children,
  } = props;
  const t = useTranslations("shell");
  const active = useActive(groups);
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // A page change closes the phone drawer.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [drawer]);

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-2">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Mabeet <span className="font-normal text-muted">· {area}</span>
        </Link>
      </div>
      <div className="mt-5">{sidebarTop}</div>
      <nav aria-label={area} className="mt-6 grid flex-1 content-start gap-6 overflow-y-auto pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">
              {group.label}
            </p>
            <ul className="grid gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={active?.href === item.href} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-1 border-t border-line pt-4">
        <Link
          href={profileHref}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2"
        >
          <Avatar name={user.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
        </Link>
        <SignOutButton label={t("signOut")} />
      </div>
    </>
  );

  const tabItems = tabs
    .map((href) => groups.flatMap((group) => group.items).find((item) => item.href === href))
    .filter((item): item is ShellLink => Boolean(item));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden border-e border-line bg-surface px-3 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        {sidebar}
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={area}
              className="fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-80 flex-col bg-paper px-3 py-5 shadow-lift lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label={t("close")}
                className="absolute end-3 top-4 grid size-10 place-items-center rounded-full hover:bg-surface-2"
              >
                <X className="size-5" aria-hidden />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t("menu")}
            className="grid size-10 place-items-center rounded-full hover:bg-surface-2 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-semibold text-muted sm:block">{area}</p>
            <p className="truncate font-display text-lg leading-tight font-semibold">
              {active?.label ?? area}
            </p>
          </div>
          {cta && <CtaLink link={cta} />}
          <Link
            href="/"
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink md:inline-flex"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("viewSite")}
          </Link>
          <NotificationBell
            feedEndpoint={notificationsFeed}
            viewAllHref={notificationsHref}
            unread={unread}
            viewerId={user.id}
            admin={admin}
          />
          <AppearanceMenu />
          <UserMenu user={user} links={userLinks} signOutLabel={t("signOut")} />
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <BackLink className="mb-4" />
          {children}
        </main>
      </div>

      <nav
        aria-label={t("tabs")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-md justify-around">
          {tabItems.map((item) => {
            const Icon = ICONS[item.icon];
            const here = active?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={here ? "page" : undefined}
                className={clsx(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold",
                  here ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold text-muted"
          >
            <MoreHorizontal className="size-5" aria-hidden />
            {t("more")}
          </button>
        </div>
      </nav>
    </div>
  );
}

function CtaLink({ link }: { link: ShellLink }) {
  const Icon = ICONS[link.icon];
  return (
    <Link
      href={link.href}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-3 text-sm font-semibold text-accent-ink shadow-soft transition-colors hover:bg-accent-strong sm:px-4"
    >
      <Icon className="size-4 text-glow" aria-hidden />
      <span className="hidden sm:inline">{link.label}</span>
    </Link>
  );
}

function NavLink({ item, active }: { item: ShellLink; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
        active ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="shell-active"
          className="absolute inset-0 rounded-lg bg-surface shadow-soft ring-1 ring-line"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      {active && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-glow" aria-hidden />}
      <Icon className={clsx("relative size-[1.1rem]", active && "text-accent")} aria-hidden />
      <span className="relative truncate">{item.label}</span>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
      {initials || "?"}
    </span>
  );
}

async function signOut() {
  await authClient.signOut();
  window.location.assign("/");
}

function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-danger"
    >
      <LogOut className="size-4 rtl:rotate-180" aria-hidden />
    </button>
  );
}

function UserMenu({
  user,
  links,
  signOutLabel,
}: {
  user: { name: string; email: string };
  links: ShellLink[];
  signOutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user.name}
        onClick={() => setOpen((value) => !value)}
        className="ms-1 rounded-full ring-offset-2 ring-offset-paper focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Avatar name={user.name} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-12 z-50 w-64 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
          >
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <div className="py-1">
              {links.map((link) => {
                const Icon = ICONS[link.icon];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-surface-2"
                  >
                    <Icon className="size-4 text-muted" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className="flex h-10 w-full items-center gap-3 rounded-lg border-t border-line px-3 text-sm text-danger transition-colors hover:bg-surface-2"
            >
              <LogOut className="size-4 rtl:rotate-180" aria-hidden />
              {signOutLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
