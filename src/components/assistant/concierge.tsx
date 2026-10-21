"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PlaceArt } from "@/components/place/place-art";
import { formatMoney } from "@/lib/format";
import { ChatPanel } from "./chat-panel";

interface SuggestedPlace {
  slug: string;
  name: string;
  area: string | null;
  currency: string;
  nightlyFromCents: number | null;
  stayTotalCents: number | null;
  bookingLink: string;
}

interface ConciergeResponse {
  reply: string;
  places: SuggestedPlace[];
}

/** Cards come straight from tool data, so the model can never put a made-up place on screen. */
function PlaceSuggestions({ places, locale }: { places: SuggestedPlace[]; locale: string }) {
  if (places.length === 0) return null;
  return (
    <ul className="-mx-1 scrollbar-none flex gap-3 overflow-x-auto px-1 pb-1">
      {places.map((place) => (
        <li key={place.slug} className="w-52 shrink-0">
          <Link
            href={place.bookingLink}
            className="group block overflow-hidden rounded-lg bg-paper ring-1 ring-line"
          >
            <PlaceArt
              seed={place.slug}
              className="h-28 w-full transition-transform duration-700 group-hover:scale-105"
            />
            <div className="p-3">
              <p className="truncate font-display font-semibold">{place.name}</p>
              <p className="truncate text-xs text-muted">{place.area}</p>
              {(place.stayTotalCents ?? place.nightlyFromCents) !== null && (
                <p className="mt-1 text-sm font-bold">
                  {formatMoney((place.stayTotalCents ?? place.nightlyFromCents)!, place.currency, locale)}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Concierge() {
  const t = useTranslations("assistant.guest");
  const locale = useLocale();
  return (
    <ChatPanel<ConciergeResponse>
      endpoint="/api/assistant"
      greeting={t("greeting")}
      suggestions={[t("suggestions.mountain"), t("suggestions.sea"), t("suggestions.arabizi")]}
      renderAttachment={(response) => <PlaceSuggestions places={response.places} locale={locale} />}
    />
  );
}
