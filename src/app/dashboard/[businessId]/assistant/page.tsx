import { getTranslations } from "next-intl/server";
import { TeamAssistant } from "@/components/assistant/team-assistant";
import { requirePermission } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function AssistantPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  requirePermission(ctx, "ai.use");
  const t = await getTranslations("assistant.team");
  return (
    <div className="grid gap-6">
      <header className="rise-in">
        <h1 className="text-4xl font-medium">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>
      </header>
      <TeamAssistant businessId={businessId} />
    </div>
  );
}
