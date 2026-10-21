import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { GuestDetailsForm } from "@/components/booking/guest-details-form";
import { PlaceArt } from "@/components/place/place-art";
import { toDateRange } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { findPageOr404 } from "@/server/http/page";
import { getCurrentUser } from "@/server/http/session";
import { getPlace, quoteRoom } from "@/server/services/directory-service";
import { stayDates } from "@/server/validation/schemas";

const bookingQuery = z
  .object({ roomId: z.string().min(1).max(64), guests: z.coerce.number().int().min(1).max(30) })
  .and(stayDates);

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bookPage");
  return { title: t("title"), robots: { index: false } };
}

export default async function BookPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const parsed = bookingQuery.safeParse(await searchParams);
  if (!parsed.success) redirect(`/p/${slug}`);
  const stay = parsed.data;

  const [t, locale, user, place] = await Promise.all([
    getTranslations("bookPage"),
    getLocale(),
    getCurrentUser(),
    findPageOr404(getPlace(slug)),
  ]);
  const room = place.rooms.find((candidate) => candidate.id === stay.roomId);
  if (!room) redirect(`/p/${slug}`);
  const range = toDateRange(stay);
  const quote = await quoteRoom(slug, room.id, range);
  const money = (cents: number) => formatMoney(cents, quote.currency, locale);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
      <Link
        href={`/p/${slug}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {place.name}
      </Link>
      <h1 className="rise-in mt-4 text-4xl font-medium sm:text-5xl">{t("title")}</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          {quote.free ? (
            <GuestDetailsForm
              slug={slug}
              stay={{
                roomId: room.id,
                checkIn: stay.checkIn,
                checkOut: stay.checkOut,
                guestCount: stay.guests,
              }}
              defaults={{ name: user?.name, email: user?.email }}
            />
          ) : (
            <div className="rounded-lg bg-danger/10 p-6">
              <p className="font-semibold text-danger">{t("taken")}</p>
              <Link
                href={`/p/${slug}`}
                className="mt-3 inline-block font-semibold underline underline-offset-4"
              >
                {t("pickOther")}
              </Link>
            </div>
          )}
        </section>

        <aside className="h-fit overflow-hidden rounded-xl bg-surface ring-1 ring-line lg:sticky lg:top-24">
          <PlaceArt seed={place.slug} className="h-36 w-full" />
          <div className="grid gap-4 p-5">
            <div>
              <p className="font-display text-xl font-semibold">{place.name}</p>
              <p className="text-sm text-muted">{room.name}</p>
            </div>
            <dl className="grid gap-2 border-t border-line pt-4 text-[0.9375rem]">
              <SummaryRow label={t("dates")} value={formatStayDates(range.checkIn, range.checkOut, locale)} />
              <SummaryRow label={t("guests")} value={String(stay.guests)} />
              <SummaryRow label={t("nights")} value={String(quote.nights.length)} />
              <SummaryRow label={t("total")} value={money(quote.totalCents)} strong />
            </dl>
            <p className="rounded-md bg-accent-soft px-4 py-3 text-sm">
              {t.rich("depositNote", {
                amount: money(quote.depositCents),
                strong: (chunk) => <strong>{chunk}</strong>,
              })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={strong ? "flex justify-between border-t border-line pt-2 font-bold" : "flex justify-between"}
    >
      <dt className={strong ? undefined : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
