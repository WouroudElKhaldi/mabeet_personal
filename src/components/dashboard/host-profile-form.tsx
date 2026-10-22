"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { LANGUAGES } from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

interface HostProfile {
  displayName: string | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  languages: string[];
  hostingSince: number | null;
  showOnListings: boolean;
}

/** The owner's own details. Always kept; shown to guests only when "show on my listings" is on. */
export function HostProfileForm({
  businessId,
  profile,
}: {
  businessId: string;
  profile: HostProfile | null;
}) {
  const t = useTranslations("hostProfile");
  const tLang = useTranslations("listing.languages");
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim() || null;
    const since = text("hostingSince");
    setSaved(false);
    run(
      () =>
        api.put(`/api/workspaces/${businessId}/host-profile`, {
          displayName: text("displayName"),
          bio: text("bio"),
          phone: text("phone")?.replace(/[\s-]/g, "") ?? null,
          whatsapp: text("whatsapp")?.replace(/[\s-]/g, "") ?? null,
          city: text("city"),
          languages: data.getAll("languages"),
          hostingSince: since ? Number(since) : null,
          showOnListings: data.get("showOnListings") === "on",
        }),
      () => setSaved(true),
    );
  };

  return (
    <form
      onSubmit={submit}
      className="grid max-w-3xl gap-5 rounded-xl bg-surface p-5 ring-1 ring-line sm:grid-cols-2"
    >
      <Field
        label={t("displayName")}
        name="displayName"
        maxLength={80}
        defaultValue={profile?.displayName ?? ""}
        hint={t("displayNameHint")}
      />
      <Field label={t("city")} name="city" maxLength={80} defaultValue={profile?.city ?? ""} />
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        placeholder="+96171123456"
        defaultValue={profile?.phone ?? ""}
      />
      <Field
        label={t("whatsapp")}
        name="whatsapp"
        type="tel"
        placeholder="+96171123456"
        defaultValue={profile?.whatsapp ?? ""}
      />
      <Field
        label={t("hostingSince")}
        name="hostingSince"
        type="number"
        min={1950}
        max={2100}
        defaultValue={profile?.hostingSince ?? ""}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("languages")}</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent/10 has-checked:ring-accent"
            >
              <input
                type="checkbox"
                name="languages"
                value={code}
                defaultChecked={profile?.languages.includes(code)}
                className="accent-accent"
              />
              {tLang(code)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <TextArea
          label={t("bio")}
          name="bio"
          maxLength={1500}
          defaultValue={profile?.bio ?? ""}
          placeholder={t("bioPlaceholder")}
        />
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-4 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="showOnListings"
          defaultChecked={profile?.showOnListings ?? false}
          className="mt-0.5 size-4 accent-accent"
        />
        <span>
          <span className="block font-semibold">{t("show")}</span>
          <span className="block text-muted">{t("showHint")}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
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
