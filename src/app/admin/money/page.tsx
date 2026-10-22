import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PayoutDecision, RefundSent } from "@/components/dashboard/payout-decision";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePageUser } from "@/server/http/session";
import { getPlatformMoney } from "@/server/services/payout-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.money");
  return { title: t("title"), robots: { index: false } };
}

const sumUsd = (rows: Array<{ currency: string; _sum: { amountCents: number | null } }>) =>
  rows.filter((row) => row.currency === "USD").reduce((sum, row) => sum + (row._sum.amountCents ?? 0), 0);

/** The founder's money page: what Mabeet earned from plans, what it owes each host, and what to send. */
export default async function AdminMoneyPage() {
  const user = await requirePageUser();
  const [t, locale, data] = await Promise.all([
    getTranslations("admin.money"),
    getLocale(),
    getPlatformMoney(user),
  ]);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);
  const byMethod = (method: string) => sumUsd(data.revenue.allTime.filter((row) => row.method === method));

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("earnedAll")} value={sumUsd(data.revenue.allTime)} kind="money" currency="USD" />
        <StatTile
          label={t("earnedMonth")}
          value={sumUsd(data.revenue.thisMonth)}
          kind="money"
          currency="USD"
        />
        <StatTile label={t("byCard")} value={byMethod("STRIPE")} kind="money" currency="USD" />
        <StatTile label={t("byWhish")} value={byMethod("WHISH")} kind="money" currency="USD" />
      </section>

      {data.revenue.byMonth.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">{t("byMonth")}</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {data.revenue.byMonth.map((row) => (
              <li key={row.month} className="flex justify-between border-b border-line py-2 tabular-nums">
                <span>{row.month}</span>
                <span>
                  {money(row.cents, "USD")} · {t("payments", { count: row.payments })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("requests")}</h2>
        {data.requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("noRequests")}</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {data.requests.map((payout) => (
              <li key={payout.id} className="grid gap-3 rounded-lg bg-surface p-4 ring-1 ring-line">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{payout.business.name}</span>
                  <span className="text-xl font-semibold tabular-nums">
                    {money(payout.amountCents, payout.currency)}
                  </span>
                </div>
                <p className="text-sm">
                  {payout.method === "WHISH"
                    ? `Whish · ${payout.whishPhone} · ${payout.accountName}`
                    : `${payout.bankName} · ${payout.iban} · ${payout.accountName}`}
                  <span className="text-muted"> · {formatDate(payout.createdAt, locale)}</span>
                </p>
                <PayoutDecision payoutId={payout.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("owed")}</h2>
        <p className="mt-1 text-sm text-muted">{t("owedIntro")}</p>
        {data.owed.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("nothingOwed")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-xl text-sm">
              <thead className="text-start text-muted">
                <tr>
                  <th className="py-2 text-start font-semibold">{t("host")}</th>
                  <th className="py-2 text-end font-semibold">{t("available")}</th>
                  <th className="py-2 text-end font-semibold">{t("upcoming")}</th>
                  <th className="py-2 text-end font-semibold">{t("requested")}</th>
                  <th className="py-2 text-end font-semibold">{t("paidOut")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.owed.map((row) => (
                  <tr key={`${row.businessId}-${row.currency}`} className="border-t border-line">
                    <td className="py-2">{row.businessName}</td>
                    <td className="py-2 text-end">{money(row.availableCents, row.currency)}</td>
                    <td className="py-2 text-end">{money(row.upcomingCents, row.currency)}</td>
                    <td className="py-2 text-end">{money(row.requestedCents, row.currency)}</td>
                    <td className="py-2 text-end">{money(row.paidOutCents, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("refunds")}</h2>
        <p className="mt-1 text-sm text-muted">{t("refundsIntro")}</p>
        {data.refunds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("noRefunds")}</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {data.refunds.map((refund) => {
              const booking = refund.payment.booking ?? refund.payment.sessionBooking;
              return (
                <li key={refund.id} className="grid gap-3 rounded-lg bg-surface p-4 ring-1 ring-line">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {booking?.guestName} · {booking?.guestPhone}
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {money(refund.amountCents, refund.currency)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {refund.business.name} · {booking?.reference} ·{" "}
                    {refund.payment.method === "WHISH" ? "Whish" : t("card")} · {refund.reason}
                  </p>
                  <RefundSent refundId={refund.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{t("recent")}</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {data.recent.map((payout) => (
              <li key={payout.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2">
                <span>{payout.business.name}</span>
                <span className="tabular-nums">
                  {money(payout.amountCents, payout.currency)} · {t(`status.${payout.status}`)}
                  {payout.reference && ` · ${payout.reference}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
