"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/api-client";

export function CreateWorkspaceForm() {
  const t = useTranslations("host");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const business = await api.post<{ id: string }>("/api/workspaces", {
        name: data.get("name"),
        area: String(data.get("area")) || undefined,
      });
      router.push(`/dashboard/${business.id}/rooms`);
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label={t("placeName")} name="name" required minLength={2} maxLength={80} placeholder="Beit…" />
      <Field label={t("area")} name="area" maxLength={80} placeholder="Batroun" />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("create")}
        {!pending && <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />}
      </Button>
    </form>
  );
}
