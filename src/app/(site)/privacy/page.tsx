import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <h1 className="text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">{t("body")}</p>
    </article>
  );
}
