"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/place/category-icon";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { LISTING_KINDS } from "@/config/listing";
import { FormError } from "@/components/ui/form-error";
import { CATEGORY_ICONS } from "@/config/category-icons";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export interface AdminCategory {
  slug: string;
  kind: (typeof LISTING_KINDS)[number];
  nameEn: string;
  nameAr: string;
  icon: string;
  position: number;
  /** Places plus experiences using it; a used category cannot be deleted. */
  uses: number;
}

const field = `${inputClass} h-10`;

function fieldsOf(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    nameEn: String(data.get("nameEn")),
    nameAr: String(data.get("nameAr")),
    icon: String(data.get("icon")),
    position: Number(data.get("position")),
  };
}

function IconSelect({ defaultValue }: { defaultValue?: string }) {
  const t = useTranslations("admin.categories");
  return (
    <select name="icon" defaultValue={defaultValue} aria-label={t("icon")} className={field}>
      {CATEGORY_ICONS.map((icon) => (
        <option key={icon} value={icon}>
          {icon}
        </option>
      ))}
    </select>
  );
}

/** Super admins add, rename, reorder and remove the categories guests browse by. */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const t = useTranslations("admin.categories");
  const { run, pending, error } = useAction();
  const [ask, confirmDialog] = useConfirm();

  const save = (slug: string) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = fieldsOf(event.currentTarget);
    run(() => api.patch(`/api/admin/categories/${slug}`, body));
  };

  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = { ...fieldsOf(form), slug: String(data.get("slug")), kind: String(data.get("kind")) };
    run(
      () => api.post("/api/admin/categories", body),
      () => form.reset(),
    );
  };

  const remove = async (category: AdminCategory) => {
    const answer = await ask({
      title: t("deleteTitle", { name: category.nameEn }),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (answer.confirmed) run(() => api.delete(`/api/admin/categories/${category.slug}`));
  };

  return (
    <div className="grid gap-8">
      {confirmDialog}
      {LISTING_KINDS.map((kind) => (
        <div key={kind}>
          <h3 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{t(`kinds.${kind}`)}</h3>
          <ul className="grid gap-2">
            {categories
              .filter((category) => category.kind === kind)
              .map((category) => (
                <li key={category.slug} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                  <form
                    onSubmit={save(category.slug)}
                    className="grid items-center gap-2 sm:grid-cols-[2rem_8rem_1fr_1fr_9rem_5rem_auto_auto]"
                  >
                    <CategoryIcon slug={category.slug} icon={category.icon} className="size-5 text-accent" />
                    <code className="truncate text-xs text-muted">{category.slug}</code>
                    <input
                      name="nameEn"
                      defaultValue={category.nameEn}
                      aria-label={t("nameEn")}
                      required
                      className={field}
                    />
                    <input
                      name="nameAr"
                      dir="rtl"
                      defaultValue={category.nameAr}
                      aria-label={t("nameAr")}
                      required
                      className={field}
                    />
                    <IconSelect defaultValue={category.icon} />
                    <input
                      name="position"
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={category.position}
                      aria-label={t("position")}
                      className={field}
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                      {t("save")}
                    </Button>
                    <button
                      type="button"
                      disabled={pending || category.uses > 0}
                      title={category.uses > 0 ? t("inUse", { count: category.uses }) : t("delete")}
                      aria-label={t("delete")}
                      onClick={() => void remove(category)}
                      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </div>
      ))}

      <form
        onSubmit={create}
        className="grid gap-2 rounded-xl border border-dashed border-line-strong p-4 sm:grid-cols-[8rem_9rem_1fr_1fr_9rem_5rem_auto]"
      >
        <p className="font-semibold sm:col-span-full">{t("new")}</p>
        <input name="slug" placeholder="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={field} />
        <select name="kind" aria-label={t("kind")} className={field}>
          {LISTING_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </select>
        <input name="nameEn" placeholder={t("nameEn")} required className={field} />
        <input name="nameAr" dir="rtl" placeholder={t("nameAr")} required className={field} />
        <IconSelect />
        <input
          name="position"
          type="number"
          min={0}
          max={999}
          defaultValue={0}
          aria-label={t("position")}
          className={field}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {t("add")}
        </Button>
      </form>
      <FormError message={error} />
    </div>
  );
}
