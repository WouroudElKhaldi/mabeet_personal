import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HeroLandscape } from "@/components/site/hero-landscape";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** What the installed app shows when the phone has no connection. The service worker keeps a copy. */
export default async function OfflinePage() {
  const t = await getTranslations("pwa");
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      <HeroLandscape />
      <div className="relative">
        <WifiOff className="mx-auto size-12 text-accent" aria-hidden strokeWidth={1.6} />
        <h1 className="mt-6 text-3xl font-semibold">{t("offlineTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("offlineBody")}</p>
      </div>
    </main>
  );
}
