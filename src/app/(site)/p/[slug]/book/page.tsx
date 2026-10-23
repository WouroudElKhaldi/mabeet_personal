import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { GuestDetailsForm } from "@/components/booking/guest-details-form";
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

  const [t, tRefund, locale, user, place] = await Promise.all([
    getTranslations("bookPage"),
    getTranslations("refundPolicy"),
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
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <h1 className="rise-in font-poster mt-4 text-[clamp(1.75rem,3.2vw,2.25rem)]">{t("title")}</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
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
              instant={place.bookingMode === "INSTANT"}
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

        <aside className="h-fit lg:sticky lg:top-28">
          <BoardingPass
            kicker={t("title")}
            title={place.name}
            subtitle={room.name}
            fields={[
              { label: t("dates"), value: formatStayDates(range.checkIn, range.checkOut, locale) },
              { label: t("guests"), value: String(stay.guests) },
              { label: t("nights"), value: String(quote.nights.length) },
              { label: t("total"), value: money(quote.totalCents) },
            ]}
            stub={
              <div className="grid gap-2 text-sm leading-relaxed">
                <p>
                  {place.paymentCollection === "ONLINE"
                    ? t.rich("payOnlineNote", {
                        amount: money(
                          place.onlineAmount === "FULL" || quote.depositCents === 0
                            ? quote.totalCents
                            : quote.depositCents,
                        ),
                        strong: (chunk) => <strong>{chunk}</strong>,
                      })
                    : t.rich("depositNote", {
                        amount: money(quote.depositCents),
                        strong: (chunk) => <strong>{chunk}</strong>,
                      })}
                </p>
                {place.paymentCollection === "ONLINE" && (
                  <p className="text-muted">
                    {tRefund(`${place.refundPolicy}.name`)}: {tRefund(`${place.refundPolicy}.rule`)}
                  </p>
                )}
              </div>
            }
          />
        </aside>
      </div>
    </div>
  );
}
