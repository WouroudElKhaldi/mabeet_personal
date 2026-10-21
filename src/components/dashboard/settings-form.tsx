"use client";

import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "./use-action";

export interface BusinessSettings {
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
  listedPublicly: boolean;
  categories: Array<{ categorySlug: string }>;
}

interface SettingsFormProps {
  businessId: string;
  settings: BusinessSettings;
  categories: Array<{ slug: string; nameEn: string; nameAr: string }>;
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null;
const number = (data: FormData, key: string) => Number(data.get(key));

export function SettingsForm({ businessId, settings, categories }: SettingsFormProps) {
  const t = useTranslations("dashboard.settings");
  const locale = useLocale();
  const { run, pending, error } = useAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(() =>
      api.patch(`/api/workspaces/${businessId}/settings`, {
        name: text(data, "name"),
        description: text(data, "description"),
        area: text(data, "area"),
        address: text(data, "address"),
        phone: text(data, "phone")?.replace(/[\s-]/g, "") ?? null,
        whatsapp: text(data, "whatsapp")?.replace(/[\s-]/g, "") ?? null,
        currency: data.get("currency"),
        commissionRateBps: Math.round(number(data, "commission") * 100),
        depositPercent: number(data, "depositPercent"),
        holdHours: number(data, "holdHours"),
        depositInstructions: text(data, "depositInstructions"),
        checkInTime: data.get("checkInTime"),
        checkOutTime: data.get("checkOutTime"),
        houseRules: text(data, "houseRules"),
        cancellationPolicy: text(data, "cancellationPolicy"),
        listedPublicly: data.get("listedPublicly") === "on",
        categories: data.getAll("categories"),
      }),
    );
  };

  const selected = new Set(settings.categories.map((category) => category.categorySlug));

  return (
    <form onSubmit={submit} className="grid gap-8">
      <Group title={t("profile")}>
        <Input label={t("name")} name="name" defaultValue={settings.name} required />
        <Input label={t("area")} name="area" defaultValue={settings.area} />
        <Input label={t("address")} name="address" defaultValue={settings.address} wide />
        <Area label={t("description")} name="description" defaultValue={settings.description} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">{t("categories")}</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
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
                {locale === "ar" ? category.nameAr : category.nameEn}
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

      <Group title={t("contact")}>
        <Input label={t("phone")} name="phone" type="tel" defaultValue={settings.phone} />
        <Input label={t("whatsapp")} name="whatsapp" type="tel" defaultValue={settings.whatsapp} />
      </Group>

      <Group title={t("bookingRules")}>
        <label className="grid gap-1 text-sm font-semibold">
          {t("currency")}
          <select name="currency" defaultValue={settings.currency} className={inputClass}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
            <option value="EUR">EUR</option>
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
        <Input label={t("checkInTime")} name="checkInTime" type="time" defaultValue={settings.checkInTime} />
        <Input
          label={t("checkOutTime")}
          name="checkOutTime"
          type="time"
          defaultValue={settings.checkOutTime}
        />
        <Area
          label={t("depositInstructions")}
          name="depositInstructions"
          defaultValue={settings.depositInstructions}
          placeholder={t("depositPlaceholder")}
        />
        <Area label={t("houseRules")} name="houseRules" defaultValue={settings.houseRules} />
        <Area
          label={t("cancellationPolicy")}
          name="cancellationPolicy"
          defaultValue={settings.cancellationPolicy}
        />
      </Group>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
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
