import { clsx } from "clsx";
import { Grid3x3 } from "lucide-react";
import Image from "next/image";
import { PhotoBrowser, PhotosLink } from "./photo-browser";
import { PlaceArt } from "./place-art";

interface Photo {
  url: string;
  alt: string | null;
}

/** One large photo and four beside it, clipped as one rounded block; generated art fills gaps for new listings. */
export function Gallery({
  photos,
  seed,
  name,
  allPhotos,
}: {
  photos: Photo[];
  seed: string;
  name: string;
  /** "Show all photos", over the corner of the gallery: opens every photo in a popup, grouped. */
  allPhotos?: {
    href: string;
    label: string;
    groups: Array<{ key: string; label: string; photos: Photo[] }>;
  };
}) {
  const tiles = Array.from({ length: 5 }, (_, index) => photos[index] ?? null);
  return (
    <div className="relative">
      <div className="grid aspect-[2/1] max-h-[30rem] w-full grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl max-sm:aspect-[4/3]">
        {tiles.map((photo, index) => (
          <div
            key={index}
            className={clsx(
              "group relative overflow-hidden bg-surface-2",
              index === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block",
            )}
          >
            {photo && allPhotos ? (
              <PhotosLink href={allPhotos.href} className="absolute inset-0">
                <Image
                  src={photo.url}
                  alt={photo.alt ?? name}
                  fill
                  priority={index === 0}
                  sizes={index === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
                  className="object-cover transition-[filter] duration-200 group-hover:brightness-90"
                />
              </PhotosLink>
            ) : photo ? (
              <Image
                src={photo.url}
                alt={photo.alt ?? name}
                fill
                priority={index === 0}
                sizes={index === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
                className="object-cover transition-[filter] duration-200 group-hover:brightness-90"
              />
            ) : (
              <PlaceArt seed={`${seed}-${index}`} className="size-full" />
            )}
          </div>
        ))}
      </div>
      {allPhotos && (
        <>
          <PhotosLink
            href={allPhotos.href}
            className="absolute end-4 bottom-4 inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-semibold shadow-lift ring-1 ring-ink/80 hover:bg-surface-2"
          >
            <Grid3x3 className="size-4" aria-hidden />
            {allPhotos.label}
          </PhotosLink>
          <PhotoBrowser groups={allPhotos.groups} title={allPhotos.label} />
        </>
      )}
    </div>
  );
}
