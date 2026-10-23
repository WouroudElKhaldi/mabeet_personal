import { BadgePercent, CalendarCheck, HandCoins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ArchWindow } from "@/components/brand/arch-window";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { Postmark } from "@/components/brand/postmark";
import { BackLink } from "@/components/shell/back-link";
import { Wordmark } from "@/components/site/wordmark";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { searchPlaces } from "@/server/services/directory-service";

/** Form on one side; on the other, the brand: real places in a triple-arch window and a boarding pass. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [t, places] = await Promise.all([
    getTranslations("auth.panel"),
    searchPlaces({ guests: 1, limit: 3 }),
  ]);
  const trust = [
    { icon: BadgePercent, text: t("trust1") },
    { icon: HandCoins, text: t("trust2") },
    { icon: CalendarCheck, text: t("trust3") },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Wordmark />
          <AppearanceMenu />
        </div>
        <main id="main" className="m-auto w-full max-w-sm py-12">
          <BackLink className="mb-6" />
          {children}
        </main>
        <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted">
          {trust.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5 text-accent" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <aside className="relative hidden overflow-hidden bg-accent px-12 pt-14 pb-12 text-accent-ink lg:flex lg:flex-col">
        <Postmark className="absolute end-10 top-10 size-28 -rotate-12 text-accent-ink opacity-90" spin />
        <p className="text-sm font-bold tracking-[0.16em] uppercase opacity-80">{t("kicker")}</p>
        <h2 className="font-poster mt-4 max-w-md text-[clamp(2rem,2.8vw,2.75rem)]">{t("title")}</h2>
        <p className="mt-4 max-w-sm text-lg leading-relaxed opacity-85">{t("body")}</p>

        <div className="relative mt-auto flex items-end pt-10">
          <ArchWindow
            photos={places.map((place) => place.photo)}
            seed="auth"
            className="w-[66%] [&>div]:ring-accent-ink/90"
          />
          <BoardingPass
            className="absolute end-0 bottom-[42%] w-[40%] max-w-72 rotate-3 text-ink"
            biteColor="var(--accent)"
            kicker={t("passKicker")}
            title={t("passTitle")}
            subtitle={t("passSubtitle")}
            fields={[
              { label: t("fees"), value: t("feesValue") },
              { label: t("deposit"), value: t("depositValue") },
              { label: t("hold"), value: t("holdValue") },
              { label: t("language"), value: t("languageValue") },
            ]}
          />
        </div>
      </aside>
    </div>
  );
}
