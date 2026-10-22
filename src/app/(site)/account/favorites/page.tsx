import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PlaceGrid } from "@/components/place/place-grid";
import { ButtonLink } from "@/components/ui/button";
import { requirePageUser } from "@/server/http/session";
import { listFavoritePlaces } from "@/server/services/favorite-service";

export default async function FavoritesPage() {
  const user = await requirePageUser();
  const [t, places] = await Promise.all([getTranslations("account"), listFavoritePlaces(user.id)]);
  if (places.length === 0) {
    return (
      <div className="grid place-items-center gap-4 rounded-xl bg-surface px-6 py-20 text-center ring-1 ring-line">
        <Heart className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
        <p className="font-display text-2xl">{t("noFavorites")}</p>
        <p className="max-w-sm text-muted">{t("noFavoritesHint")}</p>
        <ButtonLink href="/search">{t("explore")}</ButtonLink>
      </div>
    );
  }
  return <PlaceGrid places={places} savedSlugs={new Set(places.map((place) => place.slug))} signedIn />;
}
