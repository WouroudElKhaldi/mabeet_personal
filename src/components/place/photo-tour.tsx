import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PHOTO_AREAS } from "@/config/enums";

export interface TourPhoto {
  url: string;
  alt: string | null;
  area: (typeof PHOTO_AREAS)[number] | null;
}

export interface TourGroup {
  key: string;
  label: string;
  photos: TourPhoto[];
}

/**
 * The place's photos in groups: one per part of the place (living room, kitchen…), one per room, then the
 * rest. Shared by the place page's tour and the "all photos" page.
 */
export async function photoGroups(
  placePhotos: TourPhoto[],
  rooms: Array<{ id: string; name: string; photos: TourPhoto[] }>,
): Promise<TourGroup[]> {
  const t = await getTranslations("photoTour.areas");
  const byArea: TourGroup[] = PHOTO_AREAS.filter((area) => area !== "OTHER")
    .map((area) => ({
      key: area,
      label: t(area),
      photos: placePhotos.filter((photo) => photo.area === area),
    }))
    .filter((group) => group.photos.length > 0);
  const byRoom = rooms
    .filter((room) => room.photos.length > 0)
    .map((room) => ({ key: `room-${room.id}`, label: room.name, photos: room.photos }));
  const rest = placePhotos.filter((photo) => !photo.area || photo.area === "OTHER");
  return [
    ...byArea,
    ...byRoom,
    ...(rest.length > 0 ? [{ key: "OTHER", label: t("OTHER"), photos: rest }] : []),
  ];
}

/** "Photo tour": a tile per group, each opening the all-photos page at that group. */
export async function PhotoTour({ groups, href }: { groups: TourGroup[]; href: string }) {
  const t = await getTranslations("photoTour");
  if (groups.length < 2) return null;
  return (
    <section className="mt-12 border-t border-line pt-12">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold">{t("title")}</h2>
        <Link href={href} className="text-sm font-semibold underline underline-offset-4">
          {t("showAll")}
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {groups.map((group) => (
          <li key={group.key}>
            <Link href={`${href}#${group.key}`} className="group block">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                <Image
                  src={group.photos[0]!.url}
                  alt={group.photos[0]!.alt ?? group.label}
                  fill
                  sizes="(min-width: 640px) 30vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2 block font-semibold">{group.label}</span>
              <span className="block text-sm text-muted">{t("photos", { count: group.photos.length })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
