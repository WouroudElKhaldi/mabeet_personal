import { getTranslations } from "next-intl/server";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { RoomEditor } from "@/components/dashboard/room-editor";
import { SpecialPrices } from "@/components/dashboard/special-prices";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { listGallery } from "@/server/services/photo-service";
import { listRooms, listSpecialPrices } from "@/server/services/room-service";
import { getCurrency } from "@/server/services/settings-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function RoomsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["rooms.read"]);
  const [t, rooms, currency] = await Promise.all([
    getTranslations("dashboard.rooms"),
    listRooms(ctx),
    getCurrency(ctx),
  ]);
  const prices = await Promise.all(rooms.map((room) => listSpecialPrices(ctx, room.id)));
  const canEdit = can(ctx, "rooms.manage");
  const [photos, roomPhotos] = canEdit
    ? await Promise.all([
        listGallery(ctx, {}),
        Promise.all(rooms.map((room) => listGallery(ctx, { roomId: room.id }))),
      ])
    : [[], []];

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-4xl font-semibold">{t("title")}</h1>
      {canEdit && <PhotoManager businessId={businessId} photos={photos} />}
      {rooms.map((room, index) => (
        <details key={room.id} className="group rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span className="font-display text-xl font-semibold">{room.name}</span>
            <span className="text-sm text-muted">{room.active ? t("live") : t("hidden")}</span>
          </summary>
          <div className="border-t border-line p-5">
            <RoomEditor businessId={businessId} room={room} canEdit={canEdit} />
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
          <RoomEditor businessId={businessId} canEdit />
        </section>
      )}
    </div>
  );
}
