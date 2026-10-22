import { Bell } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DashboardSidebar, DashboardTabBar } from "@/components/dashboard/dashboard-nav";
import { visibleNavItems } from "@/components/dashboard/nav-items";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { Wordmark } from "@/components/site/wordmark";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { requirePageTenant } from "@/server/http/session";
import { listWorkspaces } from "@/server/services/team-service";

/** Notifications are per person, not per workspace, so the bell leads to the account's settings. */
function AlertsLink({ label }: { label: string }) {
  return (
    <Link
      href="/account/notifications"
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Bell className="size-[1.1rem]" aria-hidden />
    </Link>
  );
}

type LayoutProps = { children: ReactNode; params: Promise<{ businessId: string }> };

export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const [t, workspaces] = await Promise.all([getTranslations("dashboard"), listWorkspaces(ctx.userId)]);
  const allowed = visibleNavItems(ctx.permissions).map((item) => item.key);
  const current = workspaces.find((workspace) => workspace.businessId === businessId);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-e border-line px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-2">
          <Wordmark />
        </div>
        <div className="mt-6">
          <WorkspaceSwitcher
            current={businessId}
            workspaces={workspaces.map((workspace) => ({
              id: workspace.businessId,
              name: workspace.business.name,
              role: workspace.role.name,
            }))}
          />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <DashboardSidebar businessId={businessId} allowed={allowed} />
        </div>
        <div className="flex items-center justify-between border-t border-line px-2 pt-4">
          <Link href="/account" className="text-sm font-semibold text-muted hover:text-ink">
            {t("myAccount")}
          </Link>
          <div className="flex items-center gap-1">
            <AlertsLink label={t("phoneAlerts")} />
            <AppearanceMenu />
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur-xl lg:hidden">
          <p className="truncate font-display text-lg font-semibold">{current?.business.name}</p>
          <div className="flex items-center gap-1">
            <AlertsLink label={t("phoneAlerts")} />
            <AppearanceMenu />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
      <DashboardTabBar businessId={businessId} allowed={allowed} />
    </div>
  );
}
