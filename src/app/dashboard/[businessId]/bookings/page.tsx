import { clsx } from "clsx";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookingRow } from "@/components/dashboard/booking-row";
import { todayUtc } from "@/lib/dates";
import { requirePageTenant } from "@/server/http/session";
import { listBookings } from "@/server/services/booking-service";

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

export default async function BookingsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find((candidate) => candidate === requested) ?? "requests";
  const ctx = await requirePageTenant(businessId);
  const [t, bookings] = await Promise.all([
    getTranslations("dashboard.bookings"),
    listBookings(ctx, { ...filtersFor(tab), take: 100, skip: 0 }),
  ]);

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-4xl font-medium">{t("title")}</h1>
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
      {bookings.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-center text-muted ring-1 ring-line">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} ctx={ctx} booking={booking} />
          ))}
        </ul>
      )}
    </div>
  );
}
