import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/account/password-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title"), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <>
      <h1 className="rise-in font-poster text-[2rem]">{t("title")}</h1>
      <p className="mt-3 mb-9 text-muted">{t("subtitle")}</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
