import { CalendarPlus, Heart, HeartOff, type LucideIcon, MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/http/session";
import { listMyActivity } from "@/server/services/account-service";

const ACTIONS = {
  "booking.requested": CalendarPlus,
  "favorite.added": Heart,
  "favorite.removed": HeartOff,
  "review.submitted": MessageSquareQuote,
} satisfies Record<string, LucideIcon>;

type KnownAction = keyof typeof ACTIONS;

const isKnown = (action: string): action is KnownAction => action in ACTIONS;

export default async function ActivityPage() {
  const user = await requirePageUser();
  const [t, locale, activity] = await Promise.all([
    getTranslations("account.activity"),
    getLocale(),
    listMyActivity(user.id),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const entries = activity.flatMap((entry) =>
    isKnown(entry.action) ? [{ ...entry, action: entry.action }] : [],
  );

  if (entries.length === 0) return <p className="text-muted">{t("empty")}</p>;

  return (
    <ol className="relative grid gap-6 border-s border-line ps-6">
      {entries.map((entry) => {
        const Icon = ACTIONS[entry.action];
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -start-[2.15rem] grid size-7 place-items-center rounded-full bg-surface ring-1 ring-line">
              <Icon className="size-3.5 text-accent" aria-hidden />
            </span>
            <p className="font-semibold">
              {t(entry.action)}
              {entry.business && (
                <>
                  {" · "}
                  <Link href={`/p/${entry.business.slug}`} className="underline-offset-4 hover:underline">
                    {entry.business.name}
                  </Link>
                </>
              )}
            </p>
            <p className="text-sm text-muted">{when.format(entry.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
