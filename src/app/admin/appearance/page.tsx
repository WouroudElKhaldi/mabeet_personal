import { getTranslations } from "next-intl/server";
import { SitePalettePicker } from "@/components/dashboard/site-palette-picker";
import { PageHeader } from "@/components/shell/page-header";
import { getSitePalette } from "@/server/services/site-service";

/** The website's colour palette, chosen for everyone. Visitors only pick light or dark. */
export default async function AdminAppearancePage() {
  const [t, palette] = await Promise.all([getTranslations("admin"), getSitePalette()]);
  return (
    <>
      <PageHeader title={t("theme.title")} intro={t("theme.hint")} />
      <SitePalettePicker current={palette} />
    </>
  );
}
