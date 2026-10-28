import type { OfferingKind } from "@/config/listing";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OfferingEditor } from "@/components/dashboard/offering-editor";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { SessionScheduler } from "@/components/dashboard/session-scheduler";
import { addDays } from "@/lib/dates";
import { requirePageAccess } from "@/server/http/session";
import { listCategories } from "@/server/services/directory-service";
import { getSchedule, listOfferings } from "@/server/services/offering-service";
import { listGallery } from "@/server/services/photo-service";
import { getTimezone } from "@/server/services/settings-service";

type PageProps = { params: Promise<{ businessId: string }> };

const SCHEDULE_DAYS = 90;

export default async function OfferingsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["offerings.manage"]);
  const now = new Date();
  const [t, offerings, categories, sessions, timezone] = await Promise.all([
    getTranslations("dashboard.offerings"),
    listOfferings(ctx),
    listCategories(),
    getSchedule(ctx, now, addDays(now, SCHEDULE_DAYS)),
    getTimezone(ctx),
  ]);
  const offeringCategories = categories.filter((category) => category.kind !== "HOME");
  const galleries = await Promise.all(
    offerings.map((offering) => listGallery(ctx, { offeringId: offering.id })),
  );

  return (
    <div className="grid gap-8">
      <header className="rise-in">
        <h1 className="text-[2rem] font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </header>

      {offerings.length === 0 && <p className="text-muted">{t("empty")}</p>}

      {offerings.map((offering, index) => (
        <details key={offering.id} className="group rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span className="grid">
              <span className="font-semibold">{offering.title}</span>
              <span className="text-sm text-muted">{t(`kinds.${offering.kind as OfferingKind}`)}</span>
            </span>
            <span className="text-sm text-muted">{offering.active ? t("live") : t("hidden")}</span>
          </summary>
          <div className="border-t border-line p-5">
            <PhotoManager businessId={businessId} offeringId={offering.id} photos={galleries[index] ?? []} />
          </div>
          <div className="grid gap-8 border-t border-line p-5 lg:grid-cols-[1.3fr_1fr]">
            <OfferingEditor businessId={businessId} offering={offering} categories={offeringCategories} />
            <div className="grid content-start gap-4">
              <Link
                href={`/o/${offering.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
              >
                {t("openPage")}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
              <SessionScheduler
                businessId={businessId}
                offeringId={offering.id}
                defaultCapacity={offering.maxGuests}
                timezone={timezone}
                sessions={sessions
                  .filter((session) => session.offeringId === offering.id)
                  .map((session) => ({
                    id: session.id,
                    startsAt: session.startsAt.toISOString(),
                    capacity: session.capacity,
                    seatsTaken: session.seatsTaken,
                  }))}
              />
            </div>
          </div>
        </details>
      ))}

      <section className="rounded-xl border border-dashed border-line-strong p-5">
        <h2 className="mb-4 text-lg font-semibold">{t("new")}</h2>
        <OfferingEditor businessId={businessId} categories={offeringCategories} />
      </section>
    </div>
  );
}
