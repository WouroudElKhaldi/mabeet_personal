import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Newer / older links and "page x of y", as plain links so each page has its own URL. */
export async function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("pagination");
  const link = (target: number, enabled: boolean, children: React.ReactNode, label: string) =>
    enabled ? (
      <Link
        href={href(target)}
        aria-label={label}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"
      >
        {children}
      </Link>
    ) : (
      <span
        aria-disabled
        className={clsx(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-faint ring-1 ring-line",
        )}
      >
        {children}
      </span>
    );
  return (
    <nav aria-label={t("label")} className="mt-6 flex items-center justify-between gap-3">
      {link(
        page - 1,
        page > 1,
        <>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("newer")}
        </>,
        t("newer"),
      )}
      <p className="text-sm text-muted">{t("of", { page, pages })}</p>
      {link(
        page + 1,
        page < pages,
        <>
          {t("older")}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </>,
        t("older"),
      )}
    </nav>
  );
}
