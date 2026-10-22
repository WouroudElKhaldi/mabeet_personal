import { getTranslations } from "next-intl/server";
import { CategoryManager } from "@/components/dashboard/category-manager";
import { PageHeader } from "@/components/shell/page-header";
import { requirePageUser } from "@/server/http/session";
import { listCategoriesForAdmin } from "@/server/services/admin-service";

/** The categories guests browse by, for stays, experiences and services. */
export default async function AdminCategoriesPage() {
  const user = await requirePageUser();
  const [t, categories] = await Promise.all([getTranslations("admin"), listCategoriesForAdmin(user)]);
  return (
    <>
      <PageHeader title={t("categories.title")} intro={t("categories.hint")} />
      <CategoryManager
        categories={categories.map(({ _count, ...category }) => ({
          ...category,
          uses: _count.businesses + _count.offerings,
        }))}
      />
    </>
  );
}
