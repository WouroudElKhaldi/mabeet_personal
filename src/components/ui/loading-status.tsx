import { getTranslations } from "next-intl/server";

/** Announces loading once, for screen readers, while skeletons show. */
export async function LoadingStatus() {
  const t = await getTranslations("common");
  return (
    <p role="status" className="sr-only">
      {t("loading")}
    </p>
  );
}
