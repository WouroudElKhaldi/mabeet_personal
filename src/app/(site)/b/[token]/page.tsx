import type { BookingStatus } from "@prisma/client";
import { clsx } from "clsx";
import { Check, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { Postmark } from "@/components/brand/postmark";
import { GuestCancelButton } from "@/components/booking/guest-cancel-button";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { buttonClass } from "@/components/ui/button";
import { todayUtc } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { stagger } from "@/lib/motion";
import { formatSessionTime } from "@/lib/zoned-time";
import { getBookingForGuest } from "@/server/services/booking-service";
import { getSessionBookingForGuest } from "@/server/services/session-booking-service";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("confirmation");
  return { title: t("title"), robots: { index: false, follow: false } };
}

type Step = "requested" | "confirmed" | "deposit";

/** A room stay and a session booking, reduced to what the guest page shows. */
interface GuestBookingView {
  status: BookingStatus;
  reference: string;
  /** The host's name, used in the heading. */
  hostName: string;
  passTitle: string;
  passSubtitle: string;
  fields: Array<{ label: string; value: string }>;
  depositCents: number;
  currency: string;
  depositPaid: boolean;
  holdExpiresAt: Date | null;
  whatsapp: string | null;
  depositInstructions: string | null;
  guestName: string;
  /** Still possible to cancel: not finished and not yet started. */
  cancellable: boolean;
}

async function loadView(token: string, locale: string): Promise<GuestBookingView | null> {
  const t = await getTranslations("confirmation");
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  const stay = await getBookingForGuest(token);
  if (stay) {
    return {
      status: stay.status,
      reference: stay.reference,
      hostName: stay.business.name,
      passTitle: stay.business.name,
      passSubtitle: stay.room.name,
      fields: [
        { label: t("passenger"), value: stay.guestName },
        { label: t("dates"), value: formatStayDates(stay.checkIn, stay.checkOut, locale) },
        { label: t("guestsLabel"), value: t("guests", { count: stay.guestCount }) },
        { label: t("checkInFrom"), value: stay.business.checkInTime },
        { label: t("total"), value: money(stay.totalCents, stay.currency) },
        { label: t("deposit"), value: money(stay.depositCents, stay.currency) },
      ],
      depositCents: stay.depositCents,
      currency: stay.currency,
      depositPaid: stay.payments.some((payment) => payment.status === "PAID"),
      holdExpiresAt: stay.holdExpiresAt,
      whatsapp: stay.business.whatsapp,
      depositInstructions: stay.business.depositInstructions,
      guestName: stay.guestName,
      cancellable: ["HELD", "CONFIRMED"].includes(stay.status) && stay.checkIn > todayUtc(),
    };
  }

  const session = await getSessionBookingForGuest(token);
  if (!session) return null;
  return {
    status: session.status,
    reference: session.reference,
    hostName: session.business.name,
    passTitle: session.offering.title,
    passSubtitle: session.business.name,
    fields: [
      { label: t("passenger"), value: session.guestName },
      {
        label: t("when"),
        value: formatSessionTime(session.session.startsAt, locale, session.business.timezone),
      },
      { label: t("guestsLabel"), value: t("guests", { count: session.seats }) },
      ...(session.offering.meetingPoint
        ? [{ label: t("meetingPoint"), value: session.offering.meetingPoint }]
        : []),
      { label: t("total"), value: money(session.totalCents, session.currency) },
      { label: t("deposit"), value: money(session.depositCents, session.currency) },
    ],
    depositCents: session.depositCents,
    currency: session.currency,
    depositPaid: session.payments.some((payment) => payment.status === "PAID"),
    holdExpiresAt: session.holdExpiresAt,
    whatsapp: session.business.whatsapp,
    depositInstructions: session.business.depositInstructions,
    guestName: session.guestName,
    cancellable: ["HELD", "CONFIRMED"].includes(session.status) && session.session.startsAt > new Date(),
  };
}

/** The guest's booking, shown as a boarding pass with live status. The link is the guest's only key. */
export default async function ConfirmationPage({ params }: PageProps) {
  const { token } = await params;
  const locale = await getLocale();
  const [t, booking] = await Promise.all([getTranslations("confirmation"), loadView(token, locale)]);
  if (!booking) notFound();

  const money = (cents: number) => formatMoney(cents, booking.currency, locale);
  const closed = ["DECLINED", "EXPIRED", "CANCELLED"].includes(booking.status);
  const done: Record<Step, boolean> = {
    requested: true,
    confirmed: booking.status === "CONFIRMED",
    deposit: booking.depositPaid,
  };
  const whatsapp = booking.whatsapp?.replace(/\D/g, "");
  const message = t("whatsappMessage", { reference: booking.reference, name: booking.guestName });

  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <div>
        <h1 className="rise-in font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]">
          {t(`heading.${booking.status}`, { place: booking.hostName })}
        </h1>

        {!closed && (
          <ol className="rise-in mt-8 grid gap-2 sm:grid-cols-3" style={stagger(1)}>
            {(["requested", "confirmed", "deposit"] as const).map((step, index) => (
              <li
                key={step}
                className={clsx(
                  "flex items-center gap-3 rounded-xl p-4 ring-1",
                  done[step] ? "bg-accent text-accent-ink ring-accent" : "ring-line-strong",
                )}
              >
                <span
                  className={clsx(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    done[step] ? "bg-accent-ink text-accent" : "bg-surface-2 text-muted",
                  )}
                >
                  {done[step] ? <Check className="size-4" strokeWidth={3} aria-hidden /> : index + 1}
                </span>
                <span className="text-sm font-semibold">{t(`steps.${step}`)}</span>
              </li>
            ))}
          </ol>
        )}

        {booking.status === "HELD" && booking.holdExpiresAt && (
          <section className="mt-8 border-t border-line pt-8">
            <p className="text-sm text-muted">{t("holdIntro")}</p>
            <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
          </section>
        )}

        {!closed && !booking.depositPaid && (
          <section className="mt-8 border-t border-line pt-8">
            <h2 className="text-xl font-semibold">
              {t("depositTitle", { amount: money(booking.depositCents) })}
            </h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">
              {booking.depositInstructions ?? t("depositFallback")}
            </p>
          </section>
        )}

        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ size: "lg" }, "mt-8")}
          >
            <MessageCircle className="size-5" aria-hidden />
            {t("whatsapp")}
          </a>
        )}
        <p className="mt-6 text-sm text-muted">{t("keepLink")}</p>
        {booking.cancellable && (
          <GuestCancelButton token={token} confirmed={booking.status === "CONFIRMED"} />
        )}
      </div>

      <aside className="relative lg:pt-4">
        <Postmark className="absolute -end-4 -top-6 z-10 size-24 rotate-12" />
        <BoardingPass
          className={clsx("rise-in", closed && "opacity-70 grayscale")}
          kicker={t(`status.${booking.status}`)}
          title={booking.passTitle}
          subtitle={booking.passSubtitle}
          fields={booking.fields}
          stub={
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted uppercase">
                  {t("reference")}
                </p>
                <p className="font-poster mt-1 text-3xl tracking-wider">{booking.reference}</p>
              </div>
              {/* A decorative barcode drawn from the reference, so every pass looks like its own. */}
              <svg viewBox="0 0 60 28" className="h-10 w-24 text-ink" aria-hidden>
                {Array.from(booking.reference.replace(/\W/g, "")).flatMap((char, index) => {
                  const code = char.charCodeAt(0);
                  return [
                    <rect
                      key={`a${index}`}
                      x={index * 7}
                      y="0"
                      width={1 + (code % 3)}
                      height="28"
                      className="fill-current"
                    />,
                    <rect
                      key={`b${index}`}
                      x={index * 7 + 4}
                      y="0"
                      width={1 + ((code >> 2) % 2)}
                      height="28"
                      className="fill-current"
                    />,
                  ];
                })}
              </svg>
            </div>
          }
        />
      </aside>
    </div>
  );
}
