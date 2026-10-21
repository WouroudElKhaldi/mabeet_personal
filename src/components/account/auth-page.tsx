import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export async function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="rise-in text-4xl font-medium">{t(`${mode}.title`)}</h1>
      <p className="mt-2 mb-8 text-muted">{t(`${mode}.subtitle`)}</p>
      <Suspense>
        <AuthForm mode={mode} />
      </Suspense>
    </>
  );
}

export async function authMetadata(mode: "sign-in" | "sign-up"): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t(`${mode}.title`) };
}
