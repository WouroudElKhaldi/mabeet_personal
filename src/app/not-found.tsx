import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { HeroLandscape } from "@/components/site/hero-landscape";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      <HeroLandscape />
      <div className="relative">
        <p className="font-display text-[clamp(5rem,18vw,11rem)] leading-none font-bold tracking-tighter text-accent">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("notFoundBody")}</p>
        <ButtonLink href="/" className="mt-8">
          {t("home")}
        </ButtonLink>
      </div>
    </main>
  );
}
