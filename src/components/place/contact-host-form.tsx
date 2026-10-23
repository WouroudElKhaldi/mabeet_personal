"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

interface ContactHostFormProps {
  slug: string;
  hostName: string;
  /** The signed-in guest, to fill in their name and email. */
  guest: { name: string; email: string } | null;
  /** The stay the guest was looking at, sent along so the host knows what the question is about. */
  stay: { checkIn?: string; checkOut?: string; guests?: number };
}

/** "Still have questions? Message the host": emailed to the host, who replies straight to the guest. */
export function ContactHostForm({ slug, hostName, guest, stay }: ContactHostFormProps) {
  const t = useTranslations("contactHost");
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    run(
      () =>
        api.post(`/api/public/places/${slug}/messages`, {
          name: text("name"),
          email: text("email"),
          message: text("message"),
          ...stay,
        }),
      () => setSent(true),
    );
  };

  if (sent) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl bg-accent-soft p-6 ring-1 ring-accent-line"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-semibold">{t("sentTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("sentBody", { name: hostName })}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("name")}
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          defaultValue={guest?.name}
        />
        <Field
          label={t("email")}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={guest?.email}
          hint={t("emailHint")}
        />
      </div>
      <TextArea
        label={t("message")}
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={5}
        placeholder={t("placeholder", { name: hostName })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} size="lg">
          <Send className="size-4 rtl:-scale-x-100" aria-hidden />
          {t("send")}
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
