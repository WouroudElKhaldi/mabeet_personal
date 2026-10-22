"use client";

import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ACCESSIBILITY, ACTIVITY_LEVELS, LANGUAGES, SKILL_LEVELS, TAGS } from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export interface EditableOffering {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  categorySlug: string | null;
  area: string | null;
  meetingPoint: string | null;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: number;
  priceCents: number;
  priceUnit: string;
  maxGuests: number;
  minAge: number | null;
  activityLevel: string | null;
  skillLevel: string | null;
  included: string[];
  notIncluded: string[];
  accessibility: string[];
  languages: string[];
  tags: string[];
  cancellationHours: number;
  active: boolean;
}

interface Category {
  slug: string;
  kind: string;
  nameEn: string;
  nameAr: string;
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null;
const optionalNumber = (data: FormData, key: string) => {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : Number(raw);
};
const lines = (data: FormData, key: string) =>
  String(data.get(key) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

/** Creates an experience or service when `offering` is absent, edits it otherwise. */
export function OfferingEditor({
  businessId,
  offering,
  categories,
}: {
  businessId: string;
  offering?: EditableOffering;
  categories: Category[];
}) {
  const t = useTranslations("dashboard.offerings");
  const tListing = useTranslations("listing");
  const locale = useLocale();
  const { run, pending, error } = useAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      kind: data.get("kind"),
      title: text(data, "title"),
      description: text(data, "description"),
      categorySlug: text(data, "categorySlug"),
      area: text(data, "area"),
      meetingPoint: text(data, "meetingPoint"),
      latitude: optionalNumber(data, "latitude"),
      longitude: optionalNumber(data, "longitude"),
      durationMinutes: Number(data.get("durationMinutes")),
      priceCents: Math.round(Number(data.get("price")) * 100),
      priceUnit: data.get("priceUnit"),
      maxGuests: Number(data.get("maxGuests")),
      minAge: optionalNumber(data, "minAge"),
      activityLevel: text(data, "activityLevel"),
      skillLevel: text(data, "skillLevel"),
      included: lines(data, "included"),
      notIncluded: lines(data, "notIncluded"),
      accessibility: data.getAll("accessibility"),
      languages: data.getAll("languages"),
      tags: data.getAll("tags"),
      cancellationHours: Number(data.get("cancellationHours")),
      ...(offering && { active: data.get("active") === "on" }),
    };
    run(
      () =>
        offering
          ? api.patch(`/api/workspaces/${businessId}/offerings/${offering.id}`, body)
          : api.post(`/api/workspaces/${businessId}/offerings`, body),
      () => !offering && form.reset(),
    );
  };

  const name = (category: Category) => (locale === "ar" ? category.nameAr : category.nameEn);

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Labeled label={t("kind")}>
          <select name="kind" defaultValue={offering?.kind ?? "EXPERIENCE"} className={inputClass}>
            <option value="EXPERIENCE">{t("kinds.EXPERIENCE")}</option>
            <option value="SERVICE">{t("kinds.SERVICE")}</option>
          </select>
        </Labeled>
        <Labeled label={t("titleLabel")}>
          <input
            name="title"
            required
            minLength={3}
            maxLength={100}
            defaultValue={offering?.title}
            className={inputClass}
          />
        </Labeled>
      </div>

      <Labeled label={t("description")}>
        <textarea
          name="description"
          maxLength={4000}
          defaultValue={offering?.description ?? ""}
          className={clsx(inputClass, "h-auto min-h-24 py-3")}
        />
      </Labeled>

      <div className="grid gap-4 sm:grid-cols-3">
        <Labeled label={t("category")}>
          <select name="categorySlug" defaultValue={offering?.categorySlug ?? ""} className={inputClass}>
            <option value="">{t("none")}</option>
            {(["EXPERIENCE", "SERVICE"] as const).map((kind) => (
              <optgroup key={kind} label={t(`kinds.${kind}`)}>
                {categories
                  .filter((category) => category.kind === kind)
                  .map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {name(category)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Labeled>
        <Labeled label={t("area")}>
          <input name="area" maxLength={80} defaultValue={offering?.area ?? ""} className={inputClass} />
        </Labeled>
        <Labeled label={t("meetingPoint")}>
          <input
            name="meetingPoint"
            maxLength={200}
            defaultValue={offering?.meetingPoint ?? ""}
            className={inputClass}
          />
        </Labeled>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Labeled label={t("price")}>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={offering ? offering.priceCents / 100 : undefined}
            className={inputClass}
          />
        </Labeled>
        <Labeled label={t("priceUnit")}>
          <select name="priceUnit" defaultValue={offering?.priceUnit ?? "PER_PERSON"} className={inputClass}>
            <option value="PER_PERSON">{tListing("priceUnit.PER_PERSON")}</option>
            <option value="PER_GROUP">{tListing("priceUnit.PER_GROUP")}</option>
          </select>
        </Labeled>
        <Labeled label={t("duration")}>
          <input
            name="durationMinutes"
            type="number"
            min="15"
            max="1440"
            step="15"
            required
            defaultValue={offering?.durationMinutes ?? 120}
            className={inputClass}
          />
        </Labeled>
        <Labeled label={t("maxGuests")}>
          <input
            name="maxGuests"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={offering?.maxGuests ?? 10}
            className={inputClass}
          />
        </Labeled>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Labeled label={t("minAge")}>
          <input
            name="minAge"
            type="number"
            min="0"
            max="99"
            defaultValue={offering?.minAge ?? ""}
            className={inputClass}
          />
        </Labeled>
        <Labeled label={t("activityLevel")}>
          <select name="activityLevel" defaultValue={offering?.activityLevel ?? ""} className={inputClass}>
            <option value="">{t("notSet")}</option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {tListing(`activity.${level}`)}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label={t("skillLevel")}>
          <select name="skillLevel" defaultValue={offering?.skillLevel ?? ""} className={inputClass}>
            <option value="">{t("notSet")}</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {tListing(`skill.${level}`)}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label={t("cancellationHours")}>
          <input
            name="cancellationHours"
            type="number"
            min="0"
            max="720"
            required
            defaultValue={offering?.cancellationHours ?? 24}
            className={inputClass}
          />
        </Labeled>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label={t("included")} hint={t("listHint")}>
          <textarea
            name="included"
            defaultValue={offering?.included.join("\n")}
            className={clsx(inputClass, "h-auto min-h-24 py-3")}
          />
        </Labeled>
        <Labeled label={t("notIncluded")} hint={t("listHint")}>
          <textarea
            name="notIncluded"
            defaultValue={offering?.notIncluded.join("\n")}
            className={clsx(inputClass, "h-auto min-h-24 py-3")}
          />
        </Labeled>
      </div>

      <Chips
        legend={t("tags")}
        name="tags"
        selected={offering?.tags ?? []}
        options={TAGS.map((tag) => [tag, tListing(`tags.${tag}`)])}
      />
      <Chips
        legend={t("accessibility")}
        name="accessibility"
        selected={offering?.accessibility ?? []}
        options={ACCESSIBILITY.map((key) => [key, tListing(`accessibility.${key}`)])}
      />
      <Chips
        legend={t("languages")}
        name="languages"
        selected={offering?.languages ?? []}
        options={LANGUAGES.map((code) => [code, tListing(`languages.${code}`)])}
      />

      <div className="grid grid-cols-2 gap-4">
        <Labeled label={t("latitude")}>
          <input
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            defaultValue={offering?.latitude ?? ""}
            className={inputClass}
          />
        </Labeled>
        <Labeled label={t("longitude")}>
          <input
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            defaultValue={offering?.longitude ?? ""}
            className={inputClass}
          />
        </Labeled>
      </div>

      {offering && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={offering.active}
            className="size-4 accent-(--accent)"
          />
          {t("active")}
        </label>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {offering ? t("save") : t("create")}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Chips({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: Array<readonly [string, string]>;
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label
            key={value}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent"
          >
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
