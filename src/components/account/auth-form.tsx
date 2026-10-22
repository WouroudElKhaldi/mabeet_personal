"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  // One way in: after signing in, /home sends admins, hosts and guests each to their own place. The only
  // parameters ever on this page are an AI app's OAuth request, which must survive sign-in and sign-up.
  const params = useSearchParams();
  const next = "/home";
  const oauthQuery = params.has("client_id") ? `?${params.toString()}` : "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({
            name: String(form.get("name")),
            email,
            password,
            locale,
            callbackURL: next,
          })
        : await authClient.signIn.email({ email, password, callbackURL: next });
    if (result.error) {
      const unverified = result.error.code === "EMAIL_NOT_VERIFIED" || result.error.status === 403;
      setError(
        unverified
          ? t("notVerified")
          : mode === "sign-in"
            ? t("wrongCredentials")
            : result.error.code === "USER_ALREADY_EXISTS" ||
                result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
              ? t("emailTaken")
              : result.error.code?.startsWith("PASSWORD_TOO")
                ? t("passwordHint")
                : t("genericError"),
      );
      setPending(false);
      return;
    }
    // Signing in to connect an AI app: the OAuth flow continues at the address the server returns.
    const oauthNext = (result.data as { url?: string } | null)?.url;
    if (new URLSearchParams(window.location.search).has("client_id") && oauthNext) {
      window.location.assign(oauthNext);
      return;
    }
    // With email verification on, sign-up creates the account but no session until the link is opened.
    if (mode === "sign-up" && !result.data?.token) {
      setSentTo(email);
      setPending(false);
      return;
    }
    // A full page load, not a client-side jump: the router may still hold the "sign in first" redirect it got
    // for this page before the session existed.
    window.location.assign(next);
  };

  const other = mode === "sign-in" ? "sign-up" : "sign-in";

  if (sentTo) {
    return (
      <div role="status" className="grid gap-4 rounded-2xl bg-accent-soft p-6">
        <p className="text-lg font-semibold">{t("checkInbox.title")}</p>
        <p className="text-muted">{t("checkInbox.body", { email: sentTo })}</p>
        <Link href={`/sign-in${oauthQuery}`} className="font-semibold underline underline-offset-4">
          {t("checkInbox.back")}
        </Link>
      </div>
    );
  }

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
      {mode === "sign-in" && (
        <Link
          href="/forgot-password"
          className="-mt-2 justify-self-end text-sm font-semibold underline underline-offset-4"
        >
          {t("forgotLink")}
        </Link>
      )}
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
          href={`/${other}${oauthQuery}`}
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          {t(`${other}.title`)}
        </Link>
      </p>
    </form>
  );
}
