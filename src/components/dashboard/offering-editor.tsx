"use client";

import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { choiceChipClass, inputClass, LabeledControl } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import {
  ACCESSIBILITY,
  ACTIVITY_LEVELS,
  LANGUAGES,
  OFFERING_KINDS,
  PRICE_UNITS,
  SKILL_LEVELS,
  TAGS,
} from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { categoryName } from "@/config/appearance";
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

  const name = (category: Category) => categoryName(category, locale);

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <LabeledControl label={t("kind")}>
          <select name="kind" defaultValue={offering?.kind ?? "EXPERIENCE"} className={inputClass}>
            {OFFERING_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("titleLabel")}>
          <input
            name="title"
            required
            minLength={3}
            maxLength={100}
            defaultValue={offering?.title}
            className={inputClass}
          />
        </LabeledControl>
      </div>

      <LabeledControl label={t("description")}>
        <textarea
          name="description"
          maxLength={4000}
          defaultValue={offering?.description ?? ""}
          className={clsx(inputClass, "h-auto min-h-24 py-3")}
        />
      </LabeledControl>

      <div className="grid gap-4 sm:grid-cols-3">
        <LabeledControl label={t("category")}>
          <select name="categorySlug" defaultValue={offering?.categorySlug ?? ""} className={inputClass}>
            <option value="">{t("none")}</option>
            {OFFERING_KINDS.map((kind) => (
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
        </LabeledControl>
        <LabeledControl label={t("area")}>
          <input name="area" maxLength={80} defaultValue={offering?.area ?? ""} className={inputClass} />
        </LabeledControl>
        <LabeledControl label={t("meetingPoint")}>
          <input
            name="meetingPoint"
            maxLength={200}
            defaultValue={offering?.meetingPoint ?? ""}
            className={inputClass}
          />
        </LabeledControl>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <LabeledControl label={t("price")}>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={offering ? offering.priceCents / 100 : undefined}
            className={inputClass}
          />
        </LabeledControl>
        <LabeledControl label={t("priceUnit")}>
          <select name="priceUnit" defaultValue={offering?.priceUnit ?? "PER_PERSON"} className={inputClass}>
            {PRICE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {tListing(`priceUnit.${unit}`)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("duration")}>
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
        </LabeledControl>
        <LabeledControl label={t("maxGuests")}>
          <input
            name="maxGuests"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={offering?.maxGuests ?? 10}
            className={inputClass}
          />
        </LabeledControl>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <LabeledControl label={t("minAge")}>
          <input
            name="minAge"
            type="number"
            min="0"
            max="99"
            defaultValue={offering?.minAge ?? ""}
            className={inputClass}
          />
        </LabeledControl>
        <LabeledControl label={t("activityLevel")}>
          <select name="activityLevel" defaultValue={offering?.activityLevel ?? ""} className={inputClass}>
            <option value="">{t("notSet")}</option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {tListing(`activity.${level}`)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("skillLevel")}>
          <select name="skillLevel" defaultValue={offering?.skillLevel ?? ""} className={inputClass}>
            <option value="">{t("notSet")}</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {tListing(`skill.${level}`)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("cancellationHours")}>
          <input
            name="cancellationHours"
            type="number"
            min="0"
            max="720"
            required
            defaultValue={offering?.cancellationHours ?? 24}
            className={inputClass}
          />
        </LabeledControl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledControl label={t("included")} hint={t("listHint")}>
          <textarea
            name="included"
            defaultValue={offering?.included.join("\n")}
            className={clsx(inputClass, "h-auto min-h-24 py-3")}
          />
        </LabeledControl>
        <LabeledControl label={t("notIncluded")} hint={t("listHint")}>
          <textarea
            name="notIncluded"
            defaultValue={offering?.notIncluded.join("\n")}
            className={clsx(inputClass, "h-auto min-h-24 py-3")}
          />
        </LabeledControl>
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
        <LabeledControl label={t("latitude")}>
          <input
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            defaultValue={offering?.latitude ?? ""}
            className={inputClass}
          />
        </LabeledControl>
        <LabeledControl label={t("longitude")}>
          <input
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            defaultValue={offering?.longitude ?? ""}
            className={inputClass}
          />
        </LabeledControl>
      </div>

      {offering && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={offering.active}
            className="size-4 accent-accent"
          />
          {t("active")}
        </label>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {offering ? t("save") : t("create")}
        </Button>
        <FormError message={error} />
      </div>
    </form>
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
          <label key={value} className={choiceChipClass}>
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
