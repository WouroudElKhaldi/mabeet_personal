"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { AMENITIES } from "@/config/amenities";
import { api } from "@/lib/api-client";
import { useAction } from "./use-action";

export interface EditableRoom {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseRateCents: number;
  minNights: number;
  amenities: string[];
  active: boolean;
}

const NUMBER_FIELDS = ["capacity", "bedrooms", "beds", "bathrooms", "minNights"] as const;

/** Creates a room when `room` is absent, edits it otherwise. */
export function RoomEditor({
  businessId,
  room,
  canEdit,
}: {
  businessId: string;
  room?: EditableRoom;
  canEdit: boolean;
}) {
  const t = useTranslations("dashboard.rooms");
  const tAmenity = useTranslations("placePage.amenity");
  const { run, pending, error } = useAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name")),
      description: String(data.get("description")) || null,
      baseRateCents: Math.round(Number(data.get("rate")) * 100),
      amenities: data.getAll("amenities"),
      ...Object.fromEntries(NUMBER_FIELDS.map((field) => [field, Number(data.get(field))])),
      ...(room && { active: data.get("active") === "on" }),
    };
    run(
      () =>
        room
          ? api.patch(`/api/workspaces/${businessId}/rooms/${room.id}`, body)
          : api.post(`/api/workspaces/${businessId}/rooms`, body),
      () => !room && form.reset(),
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={!canEdit || pending} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <label className="grid gap-1 text-sm font-semibold">
            {t("name")}
            <input name="name" required maxLength={80} defaultValue={room?.name} className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("rate")}
            <input
              name="rate"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={room ? room.baseRateCents / 100 : undefined}
              className={inputClass}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          {t("description")}
          <textarea
            name="description"
            maxLength={4000}
            defaultValue={room?.description ?? ""}
            className={clsx(inputClass, "h-auto min-h-24 py-3")}
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {NUMBER_FIELDS.map((field) => (
            <label key={field} className="grid gap-1 text-xs font-semibold text-muted">
              {t(field)}
              <input
                name={field}
                type="number"
                min={field === "capacity" || field === "minNights" ? 1 : 0}
                max={60}
                required
                defaultValue={room?.[field] ?? (field === "capacity" ? 2 : 1)}
                className={`${inputClass} h-11`}
              />
            </label>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("amenities")}</legend>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((amenity) => (
              <label
                key={amenity}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line transition-colors has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent"
              >
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity}
                  defaultChecked={room?.amenities.includes(amenity)}
                  className="sr-only"
                />
                {tAmenity(amenity)}
              </label>
            ))}
          </div>
        </fieldset>
        {room && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="active"
              defaultChecked={room.active}
              className="size-4 accent-(--accent)"
            />
            {t("active")}
          </label>
        )}
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {room ? t("save") : t("create")}
          </Button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
