import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NAV_GROUPS, visibleNavItems } from "@/components/dashboard/nav-items";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { AppShell, type ShellLink } from "@/components/shell/app-shell";
import { requirePageTenant, requirePageUser } from "@/server/http/session";
import { countBusinessUnread } from "@/server/services/notification-feed-service";
import { getSettings } from "@/server/services/settings-service";
import { listWorkspaces } from "@/server/services/team-service";

type LayoutProps = { children: ReactNode; params: Promise<{ businessId: string }> };

/** The host dashboard for owners and staff: each sees only the pages their role allows. */
export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { businessId } = await params;
  const [ctx, user] = await Promise.all([requirePageTenant(businessId), requirePageUser()]);
  const [t, tShell, memberships, visited, unread] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("shell"),
    listWorkspaces(ctx.userId),
    // A platform admin visiting a business they don't belong to: show it in the switcher too.
    ctx.platformAdmin ? getSettings(ctx) : null,
    countBusinessUnread(ctx),
  ]);
  const workspaces = memberships.map((workspace) => ({
    id: workspace.businessId,
    name: workspace.business.name,
    role: workspace.role.name,
  }));
  if (visited) workspaces.unshift({ id: businessId, name: visited.name, role: tShell("adminBadge") });
  const base = `/dashboard/${businessId}`;
  const items = visibleNavItems(ctx.permissions, ctx.isOwner);
  const groups = NAV_GROUPS.map((group) => ({
    label: t(`navGroups.${group}`),
    items: items
      .filter((item) => item.group === group)
      .map((item): ShellLink => ({
        href: `${base}${item.path}`,
        label: t(`nav.${item.key}`),
        icon: item.icon,
        exact: item.path === "",
      })),
  })).filter((group) => group.items.length > 0);
  const tabs = ["", "/bookings", "/calendar", "/assistant"]
    .filter((path) => items.some((item) => item.path === path))
    .map((path) => `${base}${path}`);

  const userLinks: ShellLink[] = [
    { href: `${base}/profile`, label: tShell("profile"), icon: "user" },
    { href: `${base}/notifications`, label: tShell("notifications"), icon: "bell" },
    ...(user.platformRole === "SUPER_ADMIN"
      ? [{ href: "/admin", label: tShell("admin"), icon: "shield" } satisfies ShellLink]
      : []),
  ];

  return (
    <AppShell
      area={tShell("hostArea")}
      sidebarTop={
        <div className="grid gap-2">
          {ctx.platformAdmin && (
            <Link
              href="/admin/hosts"
              className="rounded-lg bg-glow/15 px-3 py-2 text-xs font-semibold text-ink ring-1 ring-glow/40"
            >
              {tShell("adminVisiting")}
            </Link>
          )}
          <WorkspaceSwitcher current={businessId} workspaces={workspaces} />
        </div>
      }
      groups={groups}
      tabs={tabs}
      user={{ id: user.id, name: user.name, email: user.email }}
      userLinks={userLinks}
      notificationsHref={`${base}/notifications`}
      notificationsFeed={`/api/workspaces/${businessId}/notifications`}
      unread={unread}
      profileHref={`${base}/profile`}
      cta={
        items.some((item) => item.key === "assistant")
          ? { href: `${base}/assistant`, label: tShell("askAi"), icon: "sparkles" }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
