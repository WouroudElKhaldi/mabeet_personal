"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient, safeNextPath } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: String(form.get("name")), email, password })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(mode === "sign-in" ? t("wrongCredentials") : (result.error.message ?? t("genericError")));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const other = mode === "sign-in" ? "sign-up" : "sign-in";

  return (
    <form onSubmit={submit} className="grid gap-5">
      {mode === "sign-up" && (
        <Field label={t("name")} name="name" required minLength={2} autoComplete="name" />
      )}
      <Field label={t("email")} name="email" type="email" required autoComplete="email" />
      <Field
        label={t("password")}
        name="password"
        type="password"
        required
        minLength={10}
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        hint={mode === "sign-up" ? t("passwordHint") : undefined}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t(`${mode}.submit`)}
      </Button>
      <p className="text-center text-sm text-muted">
        {t(`${mode}.switchPrompt`)}{" "}
        <Link
          href={`/${other}?next=${encodeURIComponent(next)}`}
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          {t(`${other}.title`)}
        </Link>
      </p>
    </form>
  );
}
