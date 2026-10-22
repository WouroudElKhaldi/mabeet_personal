"use client";

import { clsx } from "clsx";
import { CURRENCIES } from "@/config/enums";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { categoryName } from "@/config/appearance";
import { useAction } from "@/hooks/use-action";

interface BusinessSettings {
  name: string;
  description: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  currency: string;
  commissionRateBps: number;
  depositPercent: number;
  holdHours: number;
  depositInstructions: string | null;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string | null;
  cancellationPolicy: string | null;
  bookingMode: "REQUEST" | "INSTANT";
  paymentCollection: "AT_PLACE" | "ONLINE";
  onlineAmount: "DEPOSIT" | "FULL";
  refundPolicy: "FLEXIBLE" | "MODERATE" | "STRICT" | "NON_REFUNDABLE";
  listedPublicly: boolean;
  categories: Array<{ categorySlug: string }>;
  tags: string[];
  accessibility: string[];
  minGuestAge: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface SettingsFormProps {
  businessId: string;
  /** "place": what guests see about the place (Your place page); "general": how the business runs (Settings). */
  part: "place" | "general";
  settings: BusinessSettings;
  categories: Array<{ slug: string; kind: string; nameEn: string; nameAr: string }>;
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null;
const number = (data: FormData, key: string) => Number(data.get(key));
const optionalNumber = (data: FormData, key: string) => {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : Number(raw);
};

export function SettingsForm({ businessId, part, settings, categories }: SettingsFormProps) {
  const t = useTranslations("dashboard.settings");
  const tListing = useTranslations("listing");
  const tRefund = useTranslations("refundPolicy");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);

  // Each page saves only its own fields; the API takes any subset.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body =
      part === "place"
        ? {
            name: text(data, "name"),
            area: text(data, "area"),
            address: text(data, "address"),
            phone: text(data, "phone")?.replace(/[\s-]/g, "") ?? null,
            whatsapp: text(data, "whatsapp")?.replace(/[\s-]/g, "") ?? null,
            checkInTime: data.get("checkInTime"),
            checkOutTime: data.get("checkOutTime"),
            houseRules: text(data, "houseRules"),
            cancellationPolicy: text(data, "cancellationPolicy"),
            listedPublicly: data.get("listedPublicly") === "on",
            categories: data.getAll("categories"),
            tags: data.getAll("tags"),
            accessibility: data.getAll("accessibility"),
            minGuestAge: optionalNumber(data, "minGuestAge"),
            latitude: optionalNumber(data, "latitude"),
            longitude: optionalNumber(data, "longitude"),
          }
        : {
            currency: data.get("currency"),
            commissionRateBps: Math.round(number(data, "commission") * 100),
            depositPercent: number(data, "depositPercent"),
            holdHours: number(data, "holdHours"),
            depositInstructions: text(data, "depositInstructions"),
            bookingMode: data.get("bookingMode"),
            paymentCollection: data.get("paymentCollection"),
            onlineAmount: data.get("onlineAmount"),
            refundPolicy: data.get("refundPolicy"),
          };
    setSaved(false);
    run(
      () => api.patch(`/api/workspaces/${businessId}/settings`, body),
      () => setSaved(true),
    );
  };

  const selected = new Set(settings.categories.map((category) => category.categorySlug));
  const homeCategories = categories.filter((category) => category.kind === "HOME");

  return (
    <form onSubmit={submit} className="grid gap-8">
      {part === "place" && (
        <>
          <Group title={t("profile")}>
            <Input label={t("name")} name="name" defaultValue={settings.name} required />
            <Input label={t("area")} name="area" defaultValue={settings.area} />
            <Input label={t("address")} name="address" defaultValue={settings.address} wide />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">{t("categories")}</legend>
              <div className="flex flex-wrap gap-2">
                {homeCategories.map((category) => (
                  <label
                    key={category.slug}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent"
                  >
                    <input
                      type="checkbox"
                      name="categories"
                      value={category.slug}
                      defaultChecked={selected.has(category.slug)}
                      className="sr-only"
                    />
                    {categoryName(category, locale)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                name="listedPublicly"
                defaultChecked={settings.listedPublicly}
                className="size-4 accent-(--accent)"
              />
              {t("listedPublicly")}
            </label>
          </Group>

          <Group title={t("thingsToKnow")}>
            <ChipGroup
              legend={t("tags")}
              hint={t("tagsHint")}
              name="tags"
              options={TAGS.map((tag) => ({ value: tag, label: tListing(`tags.${tag}`) }))}
              selected={settings.tags}
            />
            <ChipGroup
              legend={t("accessibility")}
              name="accessibility"
              options={ACCESSIBILITY.map((key) => ({ value: key, label: tListing(`accessibility.${key}`) }))}
              selected={settings.accessibility}
            />
            <Input
              label={t("minGuestAge")}
              name="minGuestAge"
              type="number"
              min="0"
              max="99"
              defaultValue={settings.minGuestAge}
              hint={t("minGuestAgeHint")}
            />
          </Group>

          <Group title={t("location")}>
            <Input
              label={t("latitude")}
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              defaultValue={settings.latitude}
            />
            <Input
              label={t("longitude")}
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              defaultValue={settings.longitude}
            />
            <p className="text-sm text-muted sm:col-span-2">{t("locationHint")}</p>
          </Group>

          <Group title={t("contact")}>
            <Input label={t("phone")} name="phone" type="tel" defaultValue={settings.phone} />
            <Input label={t("whatsapp")} name="whatsapp" type="tel" defaultValue={settings.whatsapp} />
          </Group>

          <Group title={t("stayRules")}>
            <Input
              label={t("checkInTime")}
              name="checkInTime"
              type="time"
              defaultValue={settings.checkInTime}
            />
            <Input
              label={t("checkOutTime")}
              name="checkOutTime"
              type="time"
              defaultValue={settings.checkOutTime}
            />
            <Area label={t("houseRules")} name="houseRules" defaultValue={settings.houseRules} />
            <Area
              label={t("cancellationPolicy")}
              name="cancellationPolicy"
              defaultValue={settings.cancellationPolicy}
            />
          </Group>
        </>
      )}

      {part === "general" && (
        <>
          <Group title={t("bookingRules")}>
            <label className="grid gap-1 text-sm font-semibold">
              {t("currency")}
              <select name="currency" defaultValue={settings.currency} className={inputClass}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={t("commission")}
              name="commission"
              type="number"
              step="0.5"
              min="0"
              max="50"
              defaultValue={settings.commissionRateBps / 100}
              hint={t("commissionHint")}
            />
            <Input
              label={t("depositPercent")}
              name="depositPercent"
              type="number"
              min="0"
              max="100"
              defaultValue={settings.depositPercent}
            />
            <Input
              label={t("holdHours")}
              name="holdHours"
              type="number"
              min="1"
              max="168"
              defaultValue={settings.holdHours}
              hint={t("holdHint")}
            />
            <Area
              label={t("depositInstructions")}
              name="depositInstructions"
              defaultValue={settings.depositInstructions}
              placeholder={t("depositPlaceholder")}
            />
          </Group>

          <Group title={t("payments.title")}>
            <p className="text-sm text-muted sm:col-span-2">{t("payments.intro")}</p>
            <Choice
              label={t("payments.bookingMode")}
              name="bookingMode"
              defaultValue={settings.bookingMode}
              options={(["REQUEST", "INSTANT"] as const).map((value) => [
                value,
                t(`payments.modes.${value}`),
              ])}
            />
            <Choice
              label={t("payments.collection")}
              name="paymentCollection"
              defaultValue={settings.paymentCollection}
              options={(["AT_PLACE", "ONLINE"] as const).map((value) => [
                value,
                t(`payments.collections.${value}`),
              ])}
            />
            <Choice
              label={t("payments.onlineAmount")}
              name="onlineAmount"
              defaultValue={settings.onlineAmount}
              hint={t("payments.onlineAmountHint")}
              options={(["DEPOSIT", "FULL"] as const).map((value) => [value, t(`payments.amounts.${value}`)])}
            />
            <Choice
              label={t("payments.refundPolicy")}
              name="refundPolicy"
              defaultValue={settings.refundPolicy}
              hint={tRefund(`${settings.refundPolicy}.rule`)}
              options={(["FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE"] as const).map((value) => [
                value,
                `${tRefund(`${value}.name`)} · ${tRefund(`${value}.rule`)}`,
              ])}
            />
          </Group>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {saved && !error && (
          <p role="status" className="text-sm font-semibold text-success">
            {t("saved")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function Choice({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:grid-cols-2">
      <legend className="float-start mb-1 font-display text-xl font-semibold sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

type InputProps = Omit<React.ComponentProps<"input">, "defaultValue"> & {
  label: string;
  defaultValue?: string | number | null;
  hint?: string;
  wide?: boolean;
};

function Input({ label, defaultValue, hint, wide, ...props }: InputProps) {
  return (
    <label className={clsx("grid gap-1 text-sm font-semibold", wide && "sm:col-span-2")}>
      {label}
      <input defaultValue={defaultValue ?? ""} className={inputClass} {...props} />
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Area({
  label,
  defaultValue,
  ...props
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
      {label}
      <textarea
        defaultValue={defaultValue ?? ""}
        maxLength={4000}
        className={clsx(inputClass, "h-auto min-h-24 py-3")}
        {...props}
      />
    </label>
  );
}

function ChipGroup({
  legend,
  hint,
  name,
  options,
  selected,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
