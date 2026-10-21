"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { RoomQuote } from "./use-room-calendar";

/** Groups consecutive equal rates, e.g. "2 nights × $90" and "1 night × $120". */
function rateGroups(nights: RoomQuote["nights"]) {
  const groups: Array<{ rateCents: number; count: number }> = [];
  for (const night of nights) {
    const last = groups.at(-1);
    if (last?.rateCents === night.rateCents) last.count += 1;
    else groups.push({ rateCents: night.rateCents, count: 1 });
  }
  return groups;
}

export function PriceBreakdown({ quote }: { quote: RoomQuote }) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const money = (cents: number) => formatMoney(cents, quote.currency, locale);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <dl className="grid gap-2 border-t border-line pt-4 text-[0.9375rem]">
        <AnimatePresence initial={false}>
          {rateGroups(quote.nights).map((group, index) => (
            <motion.div
              key={`${group.rateCents}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between text-muted"
            >
              <dt>{t("nightsTimesRate", { count: group.count, rate: money(group.rateCents) })}</dt>
              <dd className="tabular-nums">{money(group.rateCents * group.count)}</dd>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">{money(quote.totalCents)}</dd>
        </div>
        <div className="flex justify-between rounded-md bg-accent-soft px-3 py-2 text-sm">
          <dt className="font-semibold">{t("depositNow")}</dt>
          <dd className="font-bold tabular-nums">{money(quote.depositCents)}</dd>
        </div>
      </dl>
    </motion.div>
  );
}
