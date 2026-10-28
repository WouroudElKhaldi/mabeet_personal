"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { api, ApiError, errorMessage } from "@/lib/api-client";

interface GuestDetailsFormProps {
  slug: string;
  stay: { roomId: string; checkIn: string; checkOut: string; guestCount: number };
  defaults: { name?: string; email?: string; phone?: string };
  instant: boolean;
}

export function GuestDetailsForm({ slug, stay, defaults, instant }: GuestDetailsFormProps) {
  const t = useTranslations("bookPage");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<readonly string[]>([]);
  const fieldError = (field: string, message: string) =>
    invalidFields.includes(field) ? message : undefined;
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    setInvalidFields([]);
    try {
      const booking = await api.post<{ publicToken: string }>(`/api/public/places/${slug}/bookings`, {
        ...stay,
        guestName: String(form.get("name")),
        guestPhone: String(form.get("phone")).replace(/[\s-]/g, ""),
        guestEmail: String(form.get("email")) || null,
        guestNote: String(form.get("note")) || null,
      });
      router.push(`/b/${booking.publicToken}`);
    } catch (caught) {
      const fields = caught instanceof ApiError ? caught.invalidFields : [];
      setInvalidFields(fields);
      setError(fields.length > 0 ? t("checkFields") : errorMessage(caught, t("genericError")));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field
        label={t("name")}
        name="name"
        required
        minLength={2}
        maxLength={80}
        autoComplete="name"
        defaultValue={defaults.name}
        error={fieldError("guestName", t("invalidName"))}
      />
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        required
        autoComplete="tel"
        inputMode="tel"
        pattern="\+?[0-9\s\-]{8,18}"
        placeholder="+961 71 123 456"
        defaultValue={defaults.phone ?? "+961 "}
        hint={t("phoneHint")}
        error={fieldError("guestPhone", t("invalidPhone"))}
      />
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={defaults.email}
        hint={t("emailHint")}
        error={fieldError("guestEmail", t("invalidEmail"))}
      />
      <TextArea label={t("note")} name="note" maxLength={1000} placeholder={t("notePlaceholder")} />

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full sm:w-auto sm:justify-self-start"
      >
        {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
        {instant ? t("submitInstant") : t("submit")}
        {!submitting && <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />}
      </Button>
      <p className="text-sm text-muted">{t("terms")}</p>
    </form>
  );
}
