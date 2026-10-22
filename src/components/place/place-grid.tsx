import { ResultsGrid } from "@/components/browse/results-grid";
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
    <ResultsGrid>
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
    </ResultsGrid>
  );
}
