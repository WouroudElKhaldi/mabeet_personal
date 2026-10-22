import { BadgePercent, CalendarCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArchWindow } from "@/components/brand/arch-window";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { Postmark } from "@/components/brand/postmark";
import { ConciergeBand } from "@/components/brand/concierge-band";
import { DirectReceipts } from "@/components/brand/direct-receipts";
import { Browse } from "@/components/browse/browse";
import { SearchBar } from "@/components/site/search-bar";
import { addDays, todayUtc } from "@/lib/dates";
import { formatMoney, formatStayDates } from "@/lib/format";
import { stagger } from "@/lib/motion";
import { searchPlaces } from "@/server/services/directory-service";
import { searchParams as searchSchema } from "@/server/validation/schemas";

const WEEKEND_NIGHTS = 2;

/** The coming Friday (or the one after, if today is Friday), for the sample boarding pass. */
function nextFriday(today: Date): Date {
  return addDays(today, (5 - today.getUTCDay() + 7) % 7 || 7);
}

/** The poster hero with real listings in a triple-arch window, then browsing, then the story of booking direct. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const state = searchSchema.parse(await searchParams);
  const [t, locale, places] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    searchPlaces({ guests: 1, limit: 3 }),
  ]);
  // The hero is built from real listings: their photos in the arches, one of them on the pass.
  const featured = places[1] ?? places[0];
  const checkIn = nextFriday(todayUtc());
  const checkOut = addDays(checkIn, WEEKEND_NIGHTS);

  return (
    <>
      <section className="mx-auto grid max-w-360 items-center gap-12 px-4 pt-10 pb-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10 lg:pt-14">
        <div className="min-w-0">
          <p className="rise-in inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
            <BadgePercent className="size-4" aria-hidden />
            {t("eyebrow")}
          </p>
          <h1
            className="rise-in font-poster mt-5 max-w-2xl text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[0.98] font-extrabold [font-stretch:118%] rtl:[font-stretch:100%]"
            style={stagger(1)}
          >
            {t.rich("title", { em: (chunk) => <em>{chunk}</em> })}
          </h1>
          <p className="rise-in mt-5 max-w-xl text-lg leading-relaxed text-muted" style={stagger(2)}>
            {t("subtitle")}
          </p>
          <div className="rise-in mt-8" style={stagger(3)}>
            <SearchBar
              defaults={{
                area: state.area,
                checkIn: state.checkIn,
                checkOut: state.checkOut,
                guests: state.guests,
              }}
              type={state.type}
            />
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-xl pb-16 lg:block">
          <ArchWindow
            photos={places.slice(0, 3).map((place) => place.photo)}
            seed="hero"
            priority
            className="ms-auto w-[78%]"
          />
          <Postmark className="absolute -end-6 -top-10 size-28 rotate-12" spin />
          {featured && featured.nightlyFromCents !== null && (
            <BoardingPass
              className="rise-in absolute -start-24 bottom-0 w-64 -rotate-3"
              kicker={t("pass.kicker")}
              title={featured.name.replace(/\s*\(demo\)$/, "")}
              subtitle={featured.area}
              fields={[
                { label: t("pass.dates"), value: formatStayDates(checkIn, checkOut, locale) },
                { label: t("pass.guests"), value: "2" },
                {
                  label: t("pass.total"),
                  value: formatMoney(featured.nightlyFromCents * WEEKEND_NIGHTS, featured.currency, locale),
                },
                { label: t("pass.fees"), value: formatMoney(0, featured.currency, locale) },
              ]}
              stub={
                <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <CalendarCheck className="size-4" aria-hidden />
                  {t("pass.heldNote")}
                </p>
              }
            />
          )}
        </div>
      </section>

      <Browse state={state} basePath="/" showSearch={false} />

      <DirectReceipts />

      <ConciergeBand />
    </>
  );
}
