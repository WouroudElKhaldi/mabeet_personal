import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WhishSimulatorForm } from "@/components/payments/whish-simulator-form";
import { findPageOr404 } from "@/server/http/page";
import { getPayPage } from "@/server/services/whish-simulator-service";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("whishSim");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The simulated Whish Pay page (WHISH_MODE=simulator), standing in for Whish's own hosted page. */
export default async function WhishSimulatorPage({ params }: PageProps) {
  const { code } = await params;
  const [t, payment] = await Promise.all([getTranslations("whishSim"), findPageOr404(getPayPage(code))]);
  const amount = `${payment.amount} ${payment.currency}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-sm font-bold tracking-wide text-accent uppercase">{t("title")}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t("pay", { amount })}</h1>
        {payment.invoice && <p className="mt-1 text-sm text-muted">{payment.invoice}</p>}
        <p className="mt-4 rounded-lg bg-warning/15 p-3 text-sm font-semibold text-warning">{t("banner")}</p>
        {payment.status === "pending" ? (
          <WhishSimulatorForm code={code} cancelUrl={payment.cancelUrl} />
        ) : (
          <p className="mt-6 text-muted">{t("closed")}</p>
        )}
      </div>
    </div>
  );
}
