import { clsx } from "clsx";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookingRow } from "@/components/dashboard/booking-row";
import { SessionBookingRow } from "@/components/dashboard/session-booking-row";
import { todayUtc } from "@/lib/dates";
import { requirePageAccess } from "@/server/http/session";
import { listBookings } from "@/server/services/booking-service";
import { listSessionBookings } from "@/server/services/session-booking-service";
import { getTimezone } from "@/server/services/settings-service";

const TABS = ["requests", "upcoming", "past", "all"] as const;
type Tab = (typeof TABS)[number];

function filtersFor(tab: Tab) {
  const today = todayUtc();
  switch (tab) {
    case "requests":
      return { status: "HELD" as const };
    case "upcoming":
      return { status: "CONFIRMED" as const, from: today };
    case "past":
      return { status: "CONFIRMED" as const, to: today };
    case "all":
      return {};
  }
}

type PageProps = { params: Promise<{ businessId: string }>; searchParams: Promise<{ tab?: string }> };

/** One inbox for nights in rooms and seats in experience or service sessions, under the same tabs. */
export default async function BookingsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find((candidate) => candidate === requested) ?? "requests";
  const ctx = await requirePageAccess(businessId, ["bookings.read"]);
  const filters = filtersFor(tab);
  const now = new Date();
  const [t, stays, allSessions, timezone] = await Promise.all([
    getTranslations("dashboard.bookings"),
    listBookings(ctx, { ...filters, take: 100, skip: 0 }),
    listSessionBookings(ctx, { status: filters.status, take: 100 }),
    getTimezone(ctx),
  ]);
  const sessions = allSessions.filter((booking) =>
    tab === "upcoming"
      ? booking.session.startsAt >= now
      : tab === "past"
        ? booking.session.startsAt < now
        : true,
  );

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-[2rem] font-semibold">{t("title")}</h1>
      <nav
        className="flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 sm:w-fit"
        aria-label={t("title")}
      >
        {TABS.map((option) => (
          <Link
            key={option}
            href={`?tab=${option}`}
            aria-current={tab === option ? "page" : undefined}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === option ? "bg-surface shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {t(`tabs.${option}`)}
          </Link>
        ))}
      </nav>

      {stays.length === 0 && sessions.length === 0 ? (
        <p className="rounded-xl bg-surface p-8 text-center text-muted ring-1 ring-line">{t("empty")}</p>
      ) : (
        <>
          {stays.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">{t("staysTitle")}</h2>
              <ul className="grid gap-3">
                {stays.map((booking) => (
                  <BookingRow key={booking.id} ctx={ctx} booking={booking} />
                ))}
              </ul>
            </section>
          )}
          {sessions.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">{t("sessionsTitle")}</h2>
              <ul className="grid gap-3">
                {sessions.map((booking) => (
                  <SessionBookingRow key={booking.id} ctx={ctx} booking={booking} timezone={timezone} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
