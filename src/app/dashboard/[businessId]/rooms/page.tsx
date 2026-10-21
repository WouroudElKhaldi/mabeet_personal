import { getTranslations } from "next-intl/server";
import { RoomEditor } from "@/components/dashboard/room-editor";
import { can } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";
import { listRooms } from "@/server/services/room-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function RoomsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const [t, rooms] = await Promise.all([getTranslations("dashboard.rooms"), listRooms(ctx)]);
  const canEdit = can(ctx, "rooms.manage");

  return (
    <div className="grid gap-8">
      <h1 className="rise-in text-4xl font-medium">{t("title")}</h1>
      {rooms.map((room) => (
        <details key={room.id} className="group rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span className="font-display text-xl font-semibold">{room.name}</span>
            <span className="text-sm text-muted">{room.active ? t("live") : t("hidden")}</span>
          </summary>
          <div className="border-t border-line p-5">
            <RoomEditor businessId={businessId} room={room} canEdit={canEdit} />
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
