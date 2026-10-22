import { getTranslations } from "next-intl/server";
import { TeamAssistant } from "@/components/assistant/team-assistant";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function AssistantPage({ params }: PageProps) {
  const { businessId } = await params;
  await requirePageAccess(businessId, ["ai.use"]);
  const t = await getTranslations("assistant.team");
  return (
    <div className="grid gap-6">
      <header className="rise-in">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>
      </header>
      <TeamAssistant businessId={businessId} />
    </div>
  );
}
