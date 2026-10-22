import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NAV_GROUPS, visibleNavItems } from "@/components/dashboard/nav-items";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { AppShell, type ShellLink } from "@/components/shell/app-shell";
import { requirePageTenant, requirePageUser } from "@/server/http/session";
import { listWorkspaces } from "@/server/services/team-service";

type LayoutProps = { children: ReactNode; params: Promise<{ businessId: string }> };

/** The host dashboard for owners and staff: each sees only the pages their role allows. */
export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { businessId } = await params;
  const [ctx, user] = await Promise.all([requirePageTenant(businessId), requirePageUser()]);
  const [t, tShell, workspaces] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("shell"),
    listWorkspaces(ctx.userId),
  ]);
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
  const tabs = ["", "/bookings", "/calendar", "/rooms"]
    .filter((path) => items.some((item) => item.path === path))
    .map((path) => `${base}${path}`);

  const userLinks: ShellLink[] = [
    { href: "/account", label: tShell("account"), icon: "user" },
    { href: "/account/notifications", label: tShell("notifications"), icon: "bell" },
    ...(user.platformRole === "SUPER_ADMIN"
      ? [{ href: "/admin", label: tShell("admin"), icon: "shield" } satisfies ShellLink]
      : []),
  ];

  return (
    <AppShell
      area={tShell("hostArea")}
      sidebarTop={
        <WorkspaceSwitcher
          current={businessId}
          workspaces={workspaces.map((workspace) => ({
            id: workspace.businessId,
            name: workspace.business.name,
            role: workspace.role.name,
          }))}
        />
      }
      groups={groups}
      tabs={tabs}
      user={{ name: user.name, email: user.email }}
      userLinks={userLinks}
    >
      {children}
    </AppShell>
  );
}
