import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AccountTabs } from "@/components/account/account-tabs";
import { SignOutButton } from "@/components/account/sign-out-button";
import { ButtonLink } from "@/components/ui/button";
import { requirePageUser } from "@/server/http/session";
import { listWorkspaces } from "@/server/services/team-service";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser("/account");
  const [t, workspaces] = await Promise.all([getTranslations("account"), listWorkspaces(user.id)]);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="rise-in">
          <p className="text-sm font-bold tracking-[0.14em] text-muted uppercase">{t("eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
            {t("hello", { name: user.name.split(" ")[0] ?? "" })}
          </h1>
        </div>
        <div className="flex gap-2">
          {workspaces.length > 0 && (
            <ButtonLink href="/dashboard" variant="secondary" size="sm">
              {t("hostDashboard")}
            </ButtonLink>
          )}
          {user.platformRole === "SUPER_ADMIN" && (
            <ButtonLink href="/admin" variant="secondary" size="sm">
              {t("admin")}
            </ButtonLink>
          )}
          <SignOutButton />
        </div>
      </header>
      <div className="mt-8">
        <AccountTabs />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
