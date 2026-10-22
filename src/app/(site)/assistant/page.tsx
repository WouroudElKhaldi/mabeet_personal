import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Concierge } from "@/components/assistant/concierge";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { CopyField } from "@/components/ui/copy-field";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant.guest");
  return { title: t("title") };
}

/** The trip concierge: a travel desk on the left, and on the right how to reach it from your own AI app. */
export default async function AssistantPage() {
  const [t, user] = await Promise.all([getTranslations("assistant.guest"), getCurrentUser()]);
  return (
    <div className="mx-auto grid max-w-300 gap-12 px-4 pt-10 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-10">
      <section className="min-w-0">
        <p className="text-xs font-bold tracking-[0.16em] text-accent uppercase">{t("kicker")}</p>
        <h1 className="rise-in font-poster mt-3 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">
          {t("title")}
        </h1>
        <p className="mt-4 mb-10 max-w-xl text-lg text-muted">{t("subtitle")}</p>
        <Concierge signedIn={Boolean(user)} />
      </section>

      <aside id="mcp" className="scroll-mt-28 lg:pt-24">
        <div className="grid gap-5 lg:sticky lg:top-28">
          <BoardingPass
            className="rotate-1"
            kicker={t("mcpKicker")}
            title={t("mcpTitle")}
            subtitle={t("mcpBody")}
            fields={[
              { label: t("worksWith"), value: t("anyMcp") },
              { label: t("costs"), value: t("free") },
            ]}
            stub={<CopyField value={`${env.BETTER_AUTH_URL}/api/mcp/guest`} label={t("mcpTitle")} />}
          />
          <p className="flex gap-2 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("privacy")}
          </p>
        </div>
      </aside>
    </div>
  );
}
