import { ArrowRight, Luggage } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ReviewForm } from "@/components/account/review-form";
import { PlaceArt } from "@/components/place/place-art";
import { ButtonLink } from "@/components/ui/button";
import { todayUtc } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { stagger } from "@/lib/motion";
import { formatSessionTime } from "@/lib/zoned-time";
import { requirePageUser } from "@/server/http/session";
import { listMyBookings } from "@/server/services/booking-service";
import { listMySessionBookings } from "@/server/services/session-booking-service";

export default async function TripsPage() {
  const user = await requirePageUser();
  const [t, locale, bookings, sessionBookings] = await Promise.all([
    getTranslations("account"),
    getLocale(),
    listMyBookings(user.id),
    listMySessionBookings(user.id),
  ]);
  const today = todayUtc();
  const now = new Date();
  const upcoming = bookings.filter((booking) => booking.checkOut > today);
  const past = bookings.filter((booking) => booking.checkOut <= today);

  if (bookings.length === 0 && sessionBookings.length === 0) {
    return (
      <div className="grid place-items-center gap-4 rounded-xl bg-surface px-6 py-20 text-center ring-1 ring-line">
        <Luggage className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
        <p className="font-display text-2xl">{t("noTrips")}</p>
        <ButtonLink href="/search">{t("explore")}</ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-12">
      {[
        { title: t("upcoming"), list: upcoming },
        { title: t("past"), list: past },
      ]
        .filter((group) => group.list.length > 0)
        .map((group) => (
          <section key={group.title}>
            <h2 className="mb-4 text-2xl font-semibold">{group.title}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {group.list.map((booking, index) => {
                const reviewable =
                  booking.status === "CONFIRMED" && booking.checkOut <= today && !booking.review;
                return (
                  <li
                    key={booking.id}
                    className="rise-in overflow-hidden rounded-xl bg-surface ring-1 ring-line"
                    style={stagger(index)}
                  >
                    <Link href={`/b/${booking.publicToken}`} className="group flex gap-4 p-4">
                      <PlaceArt seed={booking.business.slug} className="size-20 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-semibold">{booking.business.name}</p>
                        <p className="text-sm text-muted">
                          {booking.room.name} · {formatStayDates(booking.checkIn, booking.checkOut, locale)}
                        </p>
                        <p className="mt-1 text-sm">
                          <span className="font-semibold">{t(`status.${booking.status}`)}</span> ·{" "}
                          {formatMoney(booking.totalCents, booking.currency, locale)}
                        </p>
                      </div>
                      <ArrowRight
                        className="size-4 self-center text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                        aria-hidden
                      />
                    </Link>
                    {reviewable && (
                      <div className="px-4 pb-4">
                        <ReviewForm bookingId={booking.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      {sessionBookings.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-semibold">{t("experiences")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {sessionBookings.map((booking) => (
              <li key={booking.id} className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
                <Link href={`/b/${booking.publicToken}`} className="group flex gap-4 p-4">
                  <PlaceArt seed={booking.offering.slug} className="size-20 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{booking.offering.title}</p>
                    <p className="text-sm text-muted">
                      {booking.business.name} ·{" "}
                      {formatSessionTime(booking.session.startsAt, locale, booking.business.timezone)}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold">{t(`status.${booking.status}`)}</span> ·{" "}
                      {formatMoney(booking.totalCents, booking.currency, locale)}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 self-center text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180"
                    aria-hidden
                  />
                </Link>
                {booking.status === "CONFIRMED" && booking.session.endsAt <= now && !booking.review && (
                  <div className="px-4 pb-4">
                    <ReviewForm sessionBookingId={booking.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
