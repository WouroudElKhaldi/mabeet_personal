import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Concierge } from "@/components/assistant/concierge";
import { CopyField } from "@/components/ui/copy-field";
import { env } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant.guest");
  return { title: t("title") };
}

export default async function AssistantPage() {
  const t = await getTranslations("assistant.guest");
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="rise-in text-4xl font-medium sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 mb-8 max-w-xl text-muted">{t("subtitle")}</p>
        <Concierge />
      </section>
      <aside className="h-fit rounded-xl bg-surface p-5 ring-1 ring-line lg:mt-28">
        <h2 className="font-display text-lg font-semibold">{t("mcpTitle")}</h2>
        <p className="mt-2 mb-4 text-sm text-muted">{t("mcpBody")}</p>
        <CopyField value={`${env.BETTER_AUTH_URL}/api/mcp/guest`} label={t("mcpTitle")} />
        <p className="mt-4 text-xs text-muted">{t("privacy")}</p>
      </aside>
    </div>
  );
}
