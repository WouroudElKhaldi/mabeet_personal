import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/server/http/session";
import { HeaderShell } from "./header-shell";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations("nav"), getCurrentUser()]);
  return (
    <HeaderShell>
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Wordmark />
        <nav className="ms-8 hidden items-center gap-1 text-sm font-semibold md:flex">
          <Link
            href="/search"
            className="rounded-full px-3.5 py-2 text-muted transition-colors hover:text-ink"
          >
            {t("explore")}
          </Link>
          <Link href="/host" className="rounded-full px-3.5 py-2 text-muted transition-colors hover:text-ink">
            {t("host")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <AppearanceMenu />
          {user ? (
            <Link
              href="/account"
              className="flex h-10 items-center gap-2 rounded-full ps-1.5 pe-3.5 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-surface-2"
            >
              <span className="grid size-7 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <ButtonLink href="/sign-in" variant="secondary" size="sm">
              <CircleUserRound className="size-4" aria-hidden />
              {t("signIn")}
            </ButtonLink>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
