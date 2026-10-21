import type { PlaceCard as PlaceCardData } from "@/server/services/directory-service";
import { PlaceCard } from "./place-card";

interface PlaceGridProps {
  places: PlaceCardData[];
  savedSlugs: ReadonlySet<string>;
  signedIn: boolean;
  query?: string;
}

export function PlaceGrid({ places, savedSlugs, signedIn, query }: PlaceGridProps) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {places.map((place, index) => (
        <PlaceCard
          key={place.slug}
          place={place}
          saved={savedSlugs.has(place.slug)}
          signedIn={signedIn}
          query={query}
          index={index}
        />
      ))}
    </div>
  );
}
