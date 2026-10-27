import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { PlaceEssentials } from "@/components/dashboard/place-essentials";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { RoomEditor } from "@/components/dashboard/room-editor";
import { SpecialPrices } from "@/components/dashboard/special-prices";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { panelClass } from "@/components/ui/field";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { listGallery } from "@/server/services/photo-service";
import { listRooms, listSpecialPrices } from "@/server/services/room-service";
import { listCategories } from "@/server/services/directory-service";
import { getSettings } from "@/server/services/settings-service";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The place itself, apart from its rooms: what guests read, the photos of the whole place by area, and
 * whether it is booked room by room or as a whole (with the whole-place price and size).
 */
export default async function PlacePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["settings.manage"]);
  const [t, settings, photos, rooms, categories] = await Promise.all([
    getTranslations("place"),
    getSettings(ctx),
    listGallery(ctx, {}),
    listRooms(ctx),
    listCategories(),
  ]);
  const wholePlace = settings.bookingUnit === "WHOLE_PLACE";
  const unit = rooms.find((room) => room.kind === "WHOLE_PLACE");
  const unitPrices = wholePlace && unit ? await listSpecialPrices(ctx, unit.id) : [];
  const canEditRooms = can(ctx, "rooms.manage");

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <Link
            href={`/p/${settings.slug}`}
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("viewPage")}
          </Link>
        }
      />
      <div className="grid gap-6">
        <PlaceEssentials
          businessId={businessId}
          description={settings.description}
          bookingUnit={settings.bookingUnit}
        />

        {wholePlace && unit && (
          <Panel title={t("unitTitle")} intro={t("unitIntro")}>
            <RoomEditor businessId={businessId} room={unit} canEdit={canEditRooms} unit />
            <SpecialPrices
              businessId={businessId}
              roomId={unit.id}
              currency={settings.currency}
              baseRateCents={unit.baseRateCents}
              runs={unitPrices}
              canEdit={canEditRooms}
            />
          </Panel>
        )}

        <div className={panelClass}>
          <PhotoManager businessId={businessId} photos={photos} />
        </div>

        <SettingsForm businessId={businessId} part="place" settings={settings} categories={categories} />
      </div>
    </>
  );
}
