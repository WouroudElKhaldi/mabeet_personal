import { clsx } from "clsx";
import { Check, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, formatStayDates } from "@/lib/format";
import { stagger } from "@/lib/motion";
import { getBookingForGuest } from "@/server/services/booking-service";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("confirmation");
  return { title: t("title"), robots: { index: false, follow: false } };
}

type Step = "requested" | "confirmed" | "deposit";

export default async function ConfirmationPage({ params }: PageProps) {
  const { token } = await params;
  const booking = await getBookingForGuest(token);
  if (!booking) notFound();
  const [t, locale] = await Promise.all([getTranslations("confirmation"), getLocale()]);
  const money = (cents: number) => formatMoney(cents, booking.currency, locale);
  const depositPaid = booking.payments.some((payment) => payment.status === "PAID");
  const confirmed = booking.status === "CONFIRMED";
  const closed = ["DECLINED", "EXPIRED", "CANCELLED"].includes(booking.status);

  const done: Record<Step, boolean> = { requested: true, confirmed, deposit: depositPaid };
  const whatsapp = booking.business.whatsapp?.replace(/\D/g, "");
  const message = t("whatsappMessage", { reference: booking.reference, name: booking.guestName });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
      <p className="rise-in text-sm font-bold tracking-[0.14em] text-muted uppercase">
        {t("reference")} {booking.reference}
      </p>
      <h1 className="rise-in mt-3 text-4xl font-medium sm:text-5xl" style={stagger(1)}>
        {t(`heading.${booking.status}`, { place: booking.business.name })}
      </h1>
      <p className="rise-in mt-4 text-lg text-muted" style={stagger(2)}>
        {booking.room.name} · {formatStayDates(booking.checkIn, booking.checkOut, locale)} ·{" "}
        {t("guests", { count: booking.guestCount })}
      </p>

      {!closed && (
        <ol className="rise-in mt-10 grid gap-3 sm:grid-cols-3" style={stagger(3)}>
          {(["requested", "confirmed", "deposit"] as const).map((step, index) => (
            <li
              key={step}
              className={clsx(
                "flex items-center gap-3 rounded-lg p-4 ring-1",
                done[step] ? "bg-accent-soft ring-accent-line" : "bg-surface ring-line",
              )}
            >
              <span
                className={clsx(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                  done[step] ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
                )}
              >
                {done[step] ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span className="text-sm font-semibold">{t(`steps.${step}`)}</span>
            </li>
          ))}
        </ol>
      )}

      {booking.status === "HELD" && booking.holdExpiresAt && (
        <section className="mt-8 rounded-xl bg-surface p-6 ring-1 ring-line">
          <p className="text-sm text-muted">{t("holdIntro")}</p>
          <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
        </section>
      )}

      {!closed && !depositPaid && (
        <section className="mt-6 rounded-xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">
            {t("depositTitle", { amount: money(booking.depositCents) })}
          </h2>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">
            {booking.business.depositInstructions ?? t("depositFallback")}
          </p>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ size: "lg" })}
          >
            <MessageCircle className="size-5" aria-hidden />
            {t("whatsapp")}
          </a>
        )}
        <div className="rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
          <p className="flex justify-between">
            <span className="text-muted">{t("total")}</span>
            <span className="font-bold tabular-nums">{money(booking.totalCents)}</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span className="text-muted">{t("checkInFrom")}</span>
            <span className="font-semibold">{booking.business.checkInTime}</span>
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted">{t("keepLink")}</p>
    </div>
  );
}
