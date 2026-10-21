import { clsx } from "clsx";
import Image from "next/image";
import { stagger } from "@/lib/motion";
import { PlaceArt } from "./place-art";

interface Photo {
  url: string;
  alt: string | null;
}

/** One hero photo and up to four beside it; generated art fills the gaps for new listings. */
export function Gallery({ photos, seed, name }: { photos: Photo[]; seed: string; name: string }) {
  const tiles = Array.from({ length: 5 }, (_, index) => photos[index] ?? null);
  return (
    <div className="grid h-[min(62vh,520px)] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl">
      {tiles.map((photo, index) => (
        <div
          key={index}
          className={clsx(
            "rise-in group relative overflow-hidden bg-surface-2",
            index === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block",
          )}
          style={stagger(index)}
        >
          {photo ? (
            <Image
              src={photo.url}
              alt={photo.alt ?? name}
              fill
              priority={index === 0}
              sizes={index === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
              className="object-cover transition-transform duration-[1400ms] ease-(--ease-out) group-hover:scale-105"
            />
          ) : (
            <PlaceArt seed={`${seed}-${index}`} className="size-full" />
          )}
        </div>
      ))}
    </div>
  );
}
