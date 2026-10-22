"use client";

import { clsx } from "clsx";
import { DoorOpen, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

type Unit = "ROOMS" | "WHOLE_PLACE";

/** The place's description, and whether guests book its rooms one by one or the whole place at once. */
export function PlaceEssentials({
  businessId,
  description,
  bookingUnit,
}: {
  businessId: string;
  description: string | null;
  bookingUnit: Unit;
}) {
  const t = useTranslations("place");
  const { run, pending, error } = useAction();
  const [unit, setUnit] = useState<Unit>(bookingUnit);
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSaved(false);
        run(
          () =>
            api.patch(`/api/workspaces/${businessId}/settings`, {
              description: String(data.get("description") ?? "").trim() || null,
              bookingUnit: unit,
            }),
          () => setSaved(true),
        );
      }}
      className="grid gap-5 rounded-xl bg-surface p-5 ring-1 ring-line"
    >
      <label className="grid gap-1 text-sm font-semibold">
        {t("description")}
        <textarea
          name="description"
          maxLength={4000}
          defaultValue={description ?? ""}
          placeholder={t("descriptionPlaceholder")}
          className={clsx(inputClass, "h-auto min-h-40 py-3 font-normal")}
        />
        <span className="text-xs font-normal text-muted">{t("descriptionHint")}</span>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("howBook")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["ROOMS", DoorOpen],
              ["WHOLE_PLACE", Home],
            ] as const
          ).map(([value, Icon]) => (
            <label
              key={value}
              className={clsx(
                "flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition-colors",
                unit === value ? "bg-accent/10 ring-2 ring-accent" : "ring-line hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="bookingUnit"
                value={value}
                checked={unit === value}
                onChange={() => setUnit(value)}
                className="sr-only"
              />
              <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block font-semibold">{t(`units.${value}.title`)}</span>
                <span className="block text-sm text-muted">{t(`units.${value}.body`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
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
