import {
  Bot,
  CalendarRange,
  Compass,
  CreditCard,
  DoorOpen,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Landmark,
  type LucideIcon,
  RefreshCw,
  Settings,
  MessageSquareQuote,
  UsersRound,
} from "lucide-react";
import type { Permission } from "@/server/auth/permissions";

export interface NavItem {
  key:
    | "overview"
    | "bookings"
    | "calendar"
    | "rooms"
    | "offerings"
    | "channels"
    | "reviews"
    | "team"
    | "assistant"
    | "keys"
    | "settings"
    | "billing"
    | "payouts";
  path: string;
  icon: LucideIcon;
  /** Shown when the member holds any of these; empty means everyone. */
  anyOf: Permission[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "overview", path: "", icon: LayoutDashboard, anyOf: [] },
  { key: "bookings", path: "/bookings", icon: Inbox, anyOf: ["bookings.read"] },
  { key: "calendar", path: "/calendar", icon: CalendarRange, anyOf: ["calendar.read"] },
  { key: "rooms", path: "/rooms", icon: DoorOpen, anyOf: ["rooms.read"] },
  { key: "offerings", path: "/offerings", icon: Compass, anyOf: ["offerings.manage"] },
  { key: "channels", path: "/channels", icon: RefreshCw, anyOf: ["feeds.manage"] },
  { key: "reviews", path: "/reviews", icon: MessageSquareQuote, anyOf: ["reviews.reply"] },
  { key: "team", path: "/team", icon: UsersRound, anyOf: ["team.manage", "roles.manage"] },
  { key: "assistant", path: "/assistant", icon: Bot, anyOf: ["ai.use"] },
  { key: "keys", path: "/keys", icon: KeyRound, anyOf: ["ai.use"] },
  { key: "settings", path: "/settings", icon: Settings, anyOf: ["settings.manage"] },
  { key: "billing", path: "/billing", icon: CreditCard, anyOf: ["settings.manage"] },
  // The page itself is owners only; settings.manage is the closest permission for showing the link.
  { key: "payouts", path: "/payouts", icon: Landmark, anyOf: ["settings.manage"] },
];

export function visibleNavItems(permissions: ReadonlySet<Permission>): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.length === 0 || item.anyOf.some((p) => permissions.has(p)));
}
