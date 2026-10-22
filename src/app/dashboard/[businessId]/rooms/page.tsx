import { getTranslations } from "next-intl/server";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { RoomEditor } from "@/components/dashboard/room-editor";
import { SpecialPrices } from "@/components/dashboard/special-prices";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { listGallery } from "@/server/services/photo-service";
import { listRooms, listSpecialPrices } from "@/server/services/room-service";
import { getCurrency, getSettings } from "@/server/services/settings-service";
import Link from "next/link";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function RoomsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["rooms.read"]);
  const [t, allRooms, currency, settings] = await Promise.all([
    getTranslations("dashboard.rooms"),
    listRooms(ctx),
    getCurrency(ctx),
    can(ctx, "settings.manage") ? getSettings(ctx) : null,
  ]);
  // The whole-place unit lives on the "Your place" page.
  const rooms = allRooms.filter((room) => room.kind === "ROOM");
  const wholePlace = settings?.bookingUnit === "WHOLE_PLACE";
  const prices = await Promise.all(rooms.map((room) => listSpecialPrices(ctx, room.id)));
  const canEdit = can(ctx, "rooms.manage");
  const roomPhotos = canEdit
    ? await Promise.all(rooms.map((room) => listGallery(ctx, { roomId: room.id })))
    : [];

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-4xl font-semibold">{t("title")}</h1>
      {wholePlace && (
        <p className="rounded-xl bg-glow/15 p-4 text-sm ring-1 ring-glow/40">
          {t("wholePlaceNote")}{" "}
          <Link
            href={`/dashboard/${businessId}/place`}
            className="font-semibold underline underline-offset-4"
          >
            {t("wholePlaceLink")}
          </Link>
        </p>
      )}
      {rooms.map((room, index) => (
        <details key={room.id} className="group rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span className="font-display text-xl font-semibold">{room.name}</span>
            <span className="text-sm text-muted">
              {room.active ? (wholePlace ? t("shown") : t("live")) : t("hidden")}
            </span>
          </summary>
          <div className="border-t border-line p-5">
            <RoomEditor businessId={businessId} room={room} canEdit={canEdit} wholePlace={wholePlace} />
            {canEdit && (
              <div className="mt-8 border-t border-line pt-6">
                <PhotoManager businessId={businessId} roomId={room.id} photos={roomPhotos[index] ?? []} />
              </div>
            )}
            <SpecialPrices
              businessId={businessId}
              roomId={room.id}
              currency={currency}
              baseRateCents={room.baseRateCents}
              runs={prices[index] ?? []}
              canEdit={canEdit}
            />
          </div>
        </details>
      ))}
      {canEdit && (
        <section className="rounded-xl border border-dashed border-line-strong p-5">
          <h2 className="mb-4 font-display text-xl font-semibold">{t("new")}</h2>
          <RoomEditor businessId={businessId} canEdit wholePlace={wholePlace} />
        </section>
      )}
    </div>
  );
}
