import Link from "next/link";
import { ArrowRight, AtSign, Bot, CalendarSync, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CreateWorkspaceForm } from "@/components/account/create-workspace-form";
import { ButtonLink } from "@/components/ui/button";
import { stagger } from "@/lib/motion";
import { getCurrentUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host");
  return { title: t("title") };
}

export default async function HostPage() {
  const [t, user] = await Promise.all([getTranslations("host"), getCurrentUser()]);
  const points = [
    { icon: CalendarSync, title: t("points.sync.title"), body: t("points.sync.body") },
    { icon: ShieldCheck, title: t("points.noDouble.title"), body: t("points.noDouble.body") },
    { icon: AtSign, title: t("points.instagram.title"), body: t("points.instagram.body") },
    { icon: Bot, title: t("points.ai.title"), body: t("points.ai.body") },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-16 px-4 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section>
        <h1 className="rise-in text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] font-semibold">
          {t.rich("headline", { em: (chunk) => <em className="text-accent">{chunk}</em> })}
        </h1>
        <p className="rise-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={stagger(1)}>
          {t("intro")}
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {points.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="rise-in" style={stagger(index + 2)}>
              <Icon className="size-6 text-accent" aria-hidden strokeWidth={1.6} />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="h-fit rounded-xl bg-surface p-6 shadow-lift ring-1 ring-line sm:p-8 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">{t("formTitle")}</h2>
        <p className="mt-1 mb-6 text-sm text-muted">{t("formSubtitle")}</p>
        {user ? (
          <CreateWorkspaceForm />
        ) : (
          <div className="grid gap-3">
            <ButtonLink href="/sign-up?next=/host" size="lg">
              {t("signUpFirst")}
            </ButtonLink>
            <ButtonLink href="/sign-in?next=/host" variant="secondary">
              {t("haveAccount")}
            </ButtonLink>
          </div>
        )}
        <Link
          href="/pricing"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          {t("seePlans")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
