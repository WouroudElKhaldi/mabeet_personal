import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell, type ShellGroup, type ShellLink } from "@/components/shell/app-shell";
import { requirePageUser } from "@/server/http/session";
import { countPlatformUnread } from "@/server/services/notification-feed-service";
import { listWorkspaces } from "@/server/services/team-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: { template: `%s · ${t("title")}`, default: t("title") }, robots: { index: false } };
}

/** The platform admin area. Anyone else gets the 404 page, so it doesn't even reveal it exists. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  if (user.platformRole !== "SUPER_ADMIN") notFound();
  const [t, tShell, workspaces, unread] = await Promise.all([
    getTranslations("admin.nav"),
    getTranslations("shell"),
    listWorkspaces(user.id),
    countPlatformUnread(user),
  ]);

  const groups: ShellGroup[] = [
    {
      label: t("groups.platform"),
      items: [
        { href: "/admin", label: t("overview"), icon: "dashboard", exact: true },
        { href: "/admin/hosts", label: t("hosts"), icon: "building" },
        { href: "/admin/users", label: t("users"), icon: "users" },
      ],
    },
    { label: t("groups.money"), items: [{ href: "/admin/money", label: t("money"), icon: "wallet" }] },
    {
      label: t("groups.content"),
      items: [
        { href: "/admin/categories", label: t("categories"), icon: "tags" },
        { href: "/admin/appearance", label: t("appearance"), icon: "palette" },
      ],
    },
    {
      label: t("groups.operations"),
      items: [{ href: "/admin/health", label: t("health"), icon: "activity" }],
    },
  ];
  const [firstWorkspace] = workspaces;
  const userLinks: ShellLink[] = [
    { href: "/admin/profile", label: tShell("profile"), icon: "user" },
    { href: "/admin/notifications", label: tShell("notifications"), icon: "bell" },
    ...(firstWorkspace
      ? [
          {
            href: `/dashboard/${firstWorkspace.businessId}`,
            label: tShell("hostDashboard"),
            icon: "building",
          } satisfies ShellLink,
        ]
      : []),
  ];

  return (
    <AppShell
      area={tShell("adminArea")}
      sidebarTop={
        <div className="flex items-center gap-3 rounded-lg bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent">
          {tShell("adminBadge")}
        </div>
      }
      groups={groups}
      tabs={["/admin", "/admin/hosts", "/admin/money", "/admin/health"]}
      user={{ id: user.id, name: user.name, email: user.email }}
      userLinks={userLinks}
      notificationsHref="/admin/notifications"
      notificationsFeed="/api/admin/notifications"
      admin
      unread={unread}
      profileHref="/admin/profile"
    >
      {children}
    </AppShell>
  );
}
