import { getTranslations } from "next-intl/server";

/** "45 min", "2 hours", "2.5 hours". */
export async function Duration({ minutes }: { minutes: number }) {
  const t = await getTranslations("offering");
  if (minutes < 60) return <>{t("minutes", { count: minutes })}</>;
  return <>{t("hours", { count: Math.round((minutes / 60) * 2) / 2 })}</>;
}
