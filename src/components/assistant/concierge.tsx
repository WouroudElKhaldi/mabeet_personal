"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PlaceArt } from "@/components/place/place-art";
import { formatMoney } from "@/lib/format";
import { ChatPanel } from "./chat-panel";

interface SuggestionCard {
  slug: string;
  name: string;
  area: string | null;
  currency: string;
  priceCents: number | null;
  priceUnit: "stay" | "night" | "person" | "group";
  photoUrl: string | null;
  bookingLink: string;
}

interface ConciergeResponse {
  reply: string;
  places: SuggestionCard[];
}

/** Cards come straight from tool data, so the model can never put a made-up place or activity on screen. */
function Suggestions({ cards, locale }: { cards: SuggestionCard[]; locale: string }) {
  const t = useTranslations("assistant.guest");
  if (cards.length === 0) return null;
  return (
    <ul className="grid gap-4 ps-11 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <li key={card.slug}>
          <Link href={card.bookingLink} className="group block">
            <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-surface-2">
              {card.photoUrl ? (
                <Image
                  src={card.photoUrl}
                  alt={card.name}
                  fill
                  sizes="(min-width: 1280px) 240px, (min-width: 640px) 45vw, 90vw"
                  className="object-cover transition-transform duration-500 ease-(--ease-out) group-hover:scale-[1.04]"
                />
              ) : (
                <PlaceArt seed={card.slug} className="size-full" />
              )}
            </div>
            <div className="mt-2.5 text-sm leading-snug">
              <p className="truncate font-semibold">{card.name}</p>
              {card.area && <p className="truncate text-muted">{card.area}</p>}
              <p className="mt-1 flex items-center justify-between gap-2">
                {card.priceCents !== null ? (
                  <span>
                    <span className="font-semibold">
                      {formatMoney(card.priceCents, card.currency, locale)}
                    </span>{" "}
                    <span className="text-muted">{t(`units.${card.priceUnit}`)}</span>
                  </span>
                ) : (
                  <span />
                )}
                <span className="inline-flex items-center gap-1 font-semibold text-accent">
                  {t("open")}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden
                  />
                </span>
              </p>
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
      speaker={t("speaker")}
      greeting={t("greeting")}
      suggestions={[t("suggestions.mountain"), t("suggestions.sea"), t("suggestions.arabizi")]}
      renderAttachment={(response) => <Suggestions cards={response.places} locale={locale} />}
    />
  );
}
