"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

function Status({ saved, error, label }: { saved: boolean; error: string | null; label: string }) {
  if (error) {
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        {error}
      </p>
    );
  }
  return saved ? (
    <p role="status" className="text-sm font-semibold text-success">
      {label}
    </p>
  ) : null;
}

/** Name and phone. The email is the sign-in, so it is shown but not changed here. */
export function ProfileForm({ profile }: { profile: { name: string; email: string; phone: string | null } }) {
  const t = useTranslations("profile");
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSaved(false);
        run(
          () =>
            api.patch("/api/me/profile", {
              name: String(data.get("name") ?? "").trim(),
              phone: String(data.get("phone") ?? "").replace(/[\s-]/g, "") || null,
            }),
          () => setSaved(true),
        );
      }}
      className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:grid-cols-2"
    >
      <h2 className="text-xl font-semibold sm:col-span-2">{t("details")}</h2>
      <Field
        label={t("name")}
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={profile.name}
      />
      <Field label={t("email")} name="email" value={profile.email} readOnly disabled hint={t("emailHint")} />
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        placeholder="+96171123456"
        defaultValue={profile.phone ?? ""}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <Status saved={saved} error={error} label={t("saved")} />
      </div>
    </form>
  );
}

/** Changing the password, with the current one; other devices are signed out. */
export function PasswordForm() {
  const t = useTranslations("profile");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setPending(true);
        setError(null);
        setSaved(false);
        const result = await authClient.changePassword({
          currentPassword: String(data.get("current")),
          newPassword: String(data.get("next")),
          revokeOtherSessions: true,
        });
        setPending(false);
        if (result.error) {
          setError(result.error.code?.startsWith("PASSWORD_TOO") ? t("passwordRules") : t("passwordWrong"));
          return;
        }
        form.reset();
        setSaved(true);
      }}
      className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:grid-cols-2"
    >
      <h2 className="text-xl font-semibold sm:col-span-2">{t("password")}</h2>
      <Field
        label={t("currentPassword")}
        name="current"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label={t("newPassword")}
        name="next"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordRules")}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("changePassword")}
        </Button>
        <Status saved={saved} error={error} label={t("passwordChanged")} />
      </div>
    </form>
  );
}
