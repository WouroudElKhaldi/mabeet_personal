import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PayoutRequestForm } from "@/components/dashboard/payout-request-form";
import { StatTile } from "@/components/dashboard/stat-tile";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePageTenant } from "@/server/http/session";
import { getPayouts } from "@/server/services/payout-service";

type PageProps = { params: Promise<{ businessId: string }> };

/** What guests paid online, what Mabeet holds for this business, and asking for it. Owners only. */
export default async function PayoutsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  if (!ctx.isOwner) notFound();
  const [t, locale, data] = await Promise.all([
    getTranslations("dashboard.payouts"),
    getLocale(),
    getPayouts(ctx),
  ]);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <div className="grid gap-8">
      <header className="rise-in">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </header>

      {data.balances.length === 0 && (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
      )}
      {data.balances.map((balance) => (
        <section key={balance.currency} className="grid gap-3 sm:grid-cols-3">
          <StatTile
            kind="money"
            currency={balance.currency}
            label={t("available")}
            value={balance.availableCents}
          />
          <StatTile
            kind="money"
            currency={balance.currency}
            label={t("upcoming")}
            value={balance.upcomingCents}
            note={t("upcomingNote")}
          />
          <StatTile
            kind="money"
            currency={balance.currency}
            label={t("paidOut")}
            value={balance.paidOutCents}
            note={
              balance.requestedCents > 0
                ? t("requestedNote", { amount: money(balance.requestedCents, balance.currency) })
                : undefined
            }
          />
        </section>
      ))}

      <PayoutRequestForm
        businessId={businessId}
        balances={data.balances.map((balance) => ({
          currency: balance.currency,
          availableCents: balance.availableCents,
        }))}
        last={data.lastDetails}
      />

      <section>
        <h2 className="text-2xl font-semibold">{t("history")}</h2>
        {data.payouts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("noPayouts")}</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {data.payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-4 ring-1 ring-line"
              >
                <span className="font-semibold tabular-nums">
                  {money(payout.amountCents, payout.currency)}
                </span>
                <span className="text-sm text-muted">
                  {t(`methods.${payout.method}`)} · {formatDate(payout.createdAt, locale)}
                  {payout.reference && ` · ${payout.reference}`}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold">
                  {t(`status.${payout.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold">{t("payments")}</h2>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("noPayments")}</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {data.payments.map((payment) => {
              const booking = payment.booking ?? payment.sessionBooking;
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-4 ring-1 ring-line"
                >
                  <span>
                    <span className="font-semibold">{booking?.guestName}</span>
                    <span className="text-sm text-muted"> · {booking?.reference}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {payment.method === "WHISH" ? "Whish" : t("card")}
                    {payment.paidAt && ` · ${formatDate(payment.paidAt, locale)}`}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {money(payment.amountCents, payment.currency)}
                    {payment.refundedCents > 0 && (
                      <span className="ms-2 text-sm font-normal text-muted">
                        {t("refunded", { amount: money(payment.refundedCents, payment.currency) })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
