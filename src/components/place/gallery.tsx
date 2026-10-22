import { clsx } from "clsx";
import Image from "next/image";
import { PlaceArt } from "./place-art";

interface Photo {
  url: string;
  alt: string | null;
}

/** One large photo and four beside it, clipped as one rounded block; generated art fills gaps for new listings. */
export function Gallery({ photos, seed, name }: { photos: Photo[]; seed: string; name: string }) {
  const tiles = Array.from({ length: 5 }, (_, index) => photos[index] ?? null);
  return (
    <div className="grid aspect-[2/1] max-h-[30rem] w-full grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl max-sm:aspect-[4/3]">
      {tiles.map((photo, index) => (
        <div
          key={index}
          className={clsx(
            "group relative overflow-hidden bg-surface-2",
            index === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block",
          )}
        >
          {photo ? (
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
  );
}
