import type { IconName } from "@/components/shell/app-shell";
import type { Permission } from "@/server/auth/permissions";

export type NavGroupKey = "today" | "ai" | "bookings" | "listings" | "money" | "team" | "business";

export interface NavItem {
  key:
    | "overview"
    | "bookings"
    | "calendar"
    | "channels"
    | "place"
    | "rooms"
    | "offerings"
    | "reviews"
    | "payouts"
    | "billing"
    | "team"
    | "assistant"
    | "keys"
    | "settings";
  group: NavGroupKey;
  path: string;
  icon: IconName;
  /** Shown when the member holds any of these; empty means everyone. */
  anyOf: Permission[];
  /** Money that belongs to the business: owners only, whatever their role says. */
  ownerOnly?: boolean;
}

export const NAV_GROUPS: readonly NavGroupKey[] = [
  "today",
  "ai",
  "bookings",
  "listings",
  "money",
  "team",
  "business",
];

const NAV_ITEMS: readonly NavItem[] = [
  { key: "overview", group: "today", path: "", icon: "dashboard", anyOf: [] },
  { key: "bookings", group: "bookings", path: "/bookings", icon: "inbox", anyOf: ["bookings.read"] },
  { key: "calendar", group: "bookings", path: "/calendar", icon: "calendar", anyOf: ["calendar.read"] },
  { key: "channels", group: "bookings", path: "/channels", icon: "sync", anyOf: ["feeds.manage"] },
  { key: "place", group: "listings", path: "/place", icon: "building", anyOf: ["settings.manage"] },
  { key: "rooms", group: "listings", path: "/rooms", icon: "door", anyOf: ["rooms.read"] },
  { key: "offerings", group: "listings", path: "/offerings", icon: "compass", anyOf: ["offerings.manage"] },
  { key: "reviews", group: "listings", path: "/reviews", icon: "quote", anyOf: ["reviews.reply"] },
  { key: "payouts", group: "money", path: "/payouts", icon: "landmark", anyOf: [], ownerOnly: true },
  { key: "billing", group: "money", path: "/billing", icon: "card", anyOf: ["settings.manage"] },
  { key: "team", group: "team", path: "/team", icon: "users", anyOf: ["team.manage", "roles.manage"] },
  { key: "assistant", group: "ai", path: "/assistant", icon: "sparkles", anyOf: ["ai.use"] },
  { key: "keys", group: "ai", path: "/keys", icon: "bot", anyOf: ["ai.use"] },
  { key: "settings", group: "business", path: "/settings", icon: "settings", anyOf: ["settings.manage"] },
];

/** The pages a member may open: by permission, and money pages only for owners. */
export function visibleNavItems(permissions: ReadonlySet<Permission>, isOwner: boolean): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.ownerOnly || isOwner) &&
      (item.anyOf.length === 0 || item.anyOf.some((permission) => permissions.has(permission))),
  );
}
