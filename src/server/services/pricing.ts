import { type DateRange, eachNight, toIsoDate } from "@/lib/dates";

interface NightlyRate {
  date: string;
  rateCents: number;
}

export interface StayQuote {
  nights: NightlyRate[];
  totalCents: number;
  depositCents: number;
}

export interface PricingInput {
  range: DateRange;
  baseRateCents: number;
  /** Rate overrides keyed by ISO date. */
  overrides: ReadonlyMap<string, number>;
  depositPercent: number;
}

export function quoteStay({ range, baseRateCents, overrides, depositPercent }: PricingInput): StayQuote {
  const nights = eachNight(range).map((night) => {
    const date = toIsoDate(night);
    return { date, rateCents: overrides.get(date) ?? baseRateCents };
  });
  const totalCents = nights.reduce((sum, night) => sum + night.rateCents, 0);
  return { nights, totalCents, depositCents: Math.ceil((totalCents * depositPercent) / 100) };
}
