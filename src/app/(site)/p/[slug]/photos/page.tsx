import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { photoGroups } from "@/components/place/photo-tour";
import { findPageOr404 } from "@/server/http/page";
import { getPlace } from "@/server/services/directory-service";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const place = await findPageOr404(getPlace((await params).slug));
  const t = await getTranslations("photoTour");
  return { title: `${t("title")} · ${place.name}` };
}

/** Every photo of a place, grouped by part of the place and by room, with jump links at the top. */
export default async function PlacePhotosPage({ params }: PageProps) {
  const { slug } = await params;
  const [t, place] = await Promise.all([getTranslations("photoTour"), findPageOr404(getPlace(slug))]);
  const groups = await photoGroups(place.photos, [...place.rooms, ...place.showcaseRooms]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
      <Link
        href={`/p/${slug}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {place.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">{t("title")}</h1>

      {groups.length === 0 ? (
        <p className="mt-6 text-muted">{t("none")}</p>
      ) : (
        <>
          <nav
            aria-label={t("title")}
            className="sticky top-16 z-10 -mx-4 mt-6 overflow-x-auto bg-paper/90 px-4 py-3 backdrop-blur"
          >
            <ul className="flex gap-2">
              {groups.map((group) => (
                <li key={group.key}>
                  <a
                    href={`#${group.key}`}
                    className="block rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-line hover:bg-surface-2"
                  >
                    {group.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {groups.map((group) => (
            <section
              key={group.key}
              id={group.key}
              className="scroll-mt-32 border-b border-line py-10 last:border-0 md:grid md:grid-cols-[200px_1fr] md:gap-8"
            >
              <h2 className="text-xl font-semibold">{group.label}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:mt-0">
                {group.photos.map((photo, index) => (
                  <li
                    key={photo.url}
                    className={index === 0 && group.photos.length % 2 === 1 ? "sm:col-span-2" : undefined}
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                      <Image
                        src={photo.url}
                        alt={photo.alt ?? group.label}
                        fill
                        sizes="(min-width: 768px) 40vw, 100vw"
                        className="object-cover"
                      />
                    </span>
                    {photo.alt && <p className="mt-1 text-sm text-muted">{photo.alt}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
