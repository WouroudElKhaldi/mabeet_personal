import { clsx } from "clsx";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { STATUS_TONE } from "@/components/billing/plan-request-status";
import { PaymentOptionsEditor, PlanRequestDecision } from "@/components/billing/plan-requests-admin";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { listAllPaymentOptions, listPlanRequests } from "@/server/services/plan-request-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminBilling");
  return { title: t("title"), robots: { index: false } };
}

/**
 * Plans paid by hand: the requests hosts sent with their receipts (approve starts the plan at once), and the
 * bank accounts, numbers and wallets hosts can pay Mabeet with.
 */
export default async function AdminBillingPage() {
  const user = await requirePageUser();
  const [t, tPlans, tManual, locale, requests, options] = await Promise.all([
    getTranslations("adminBilling"),
    getTranslations("plans"),
    getTranslations("manualPlan"),
    getLocale(),
    listPlanRequests(user, null),
    listAllPaymentOptions(user),
  ]);
  const waiting = requests.filter((request) => request.status === "PENDING");
  const decided = requests.filter((request) => request.status !== "PENDING").slice(0, 30);

  const describe = (request: (typeof requests)[number]) => (
    <>
      <p className="font-semibold">
        {request.business.name} ·{" "}
        {tManual("planMonths", { plan: tPlans(`names.${request.plan}`), count: request.months })} ·{" "}
        <span className="tabular-nums">{formatMoney(request.amountCents, request.currency, locale)}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        {[
          tManual(`methods.${request.method}`),
          request.payerReference ? t("ref", { reference: request.payerReference }) : null,
          request.requestedBy ? `${request.requestedBy.name} (${request.requestedBy.email})` : null,
          formatDate(request.createdAt, locale),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {request.note && <p className="mt-1 text-sm">“{request.note}”</p>}
    </>
  );

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid gap-6">
        <Panel title={t("waiting", { count: waiting.length })}>
          {waiting.length === 0 ? (
            <p className="text-sm text-muted">{t("noneWaiting")}</p>
          ) : (
            <ul className="grid gap-3">
              {waiting.map((request) => (
                <li key={request.id} className="grid gap-3 rounded-lg p-4 ring-1 ring-line">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">{describe(request)}</div>
                    <a
                      href={`/api/admin/plan-requests/${request.id}/receipt`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-semibold underline underline-offset-4"
                    >
                      {t("receipt")}
                    </a>
                  </div>
                  <PlanRequestDecision requestId={request.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("optionsTitle")} intro={t("optionsIntro")}>
          <PaymentOptionsEditor options={options} />
        </Panel>

        {decided.length > 0 && (
          <Panel title={t("decided")}>
            <ul className="divide-y divide-line">
              {decided.map((request) => (
                <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    {describe(request)}
                    {request.decisionNote && (
                      <p className="mt-1 text-sm text-muted">
                        {tManual("adminNote", { note: request.decisionNote })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        STATUS_TONE[request.status],
                      )}
                    >
                      {tManual(`status.${request.status}`)}
                    </span>
                    <a
                      href={`/api/admin/plan-requests/${request.id}/receipt`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-semibold underline underline-offset-4"
                    >
                      {t("receipt")}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
