import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { requirePageTenant } from "@/server/http/session";
import { listCategories } from "@/server/services/directory-service";
import { getSettings } from "@/server/services/settings-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function SettingsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const [t, settings, categories] = await Promise.all([
    getTranslations("dashboard.settings"),
    getSettings(ctx),
    listCategories(),
  ]);
  return (
    <div className="grid gap-8">
      <header className="rise-in">
        <h1 className="text-4xl font-medium">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("publicLink", { url: `/p/${settings.slug}` })}</p>
      </header>
      <SettingsForm businessId={businessId} settings={settings} categories={categories} />
    </div>
  );
}
