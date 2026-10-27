import { clsx } from "clsx";
import { LoadingStatus } from "@/components/ui/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders shaped like the real dashboard pieces (same sizes, cards and spacing), so a page doesn't
// jump when it arrives. Each route's loading.tsx composes them to match that page.

const card = "rounded-xl bg-surface ring-1 ring-line";

/** The page title block (PageHeader): accent bar, title, intro line, and an optional action. */
export function SkHeader({ intro = true, action = false }: { intro?: boolean; action?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <LoadingStatus />
      <div className="grid gap-3">
        <Skeleton className="h-1 w-10 rounded-full" />
        <Skeleton className="h-9 w-56" />
        {intro && <Skeleton className="h-4 w-80 max-w-full" />}
      </div>
      {action && <Skeleton className="h-10 w-36 rounded-full" />}
    </div>
  );
}

/** A row of stat tiles. */
export function SkTiles({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={clsx("grid grid-cols-2 gap-3", count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={clsx(card, "grid gap-3 p-5")}>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

/** A titled card with a few lines (Panel). */
export function SkPanel({
  lines = 3,
  title = true,
  className,
}: {
  lines?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx(card, "grid content-start gap-3 p-5", className)}>
      {title && <Skeleton className="mb-1 h-6 w-40" />}
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={clsx("h-4", index % 3 === 2 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** A list of row cards: an icon or avatar, two lines, and something at the end. */
export function SkRows({
  count = 5,
  avatar = true,
  tall = false,
}: {
  count?: number;
  avatar?: boolean;
  tall?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={clsx(card, "flex items-center gap-4 p-4", tall && "py-6")}>
          {avatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The divided list used for notifications and the audit log. */
export function SkFeed({ count = 8 }: { count?: number }) {
  return (
    <div className={clsx(card, "divide-y divide-line overflow-hidden")}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A form card with titled groups of fields (two columns on wider screens). */
export function SkForm({
  groups = 2,
  fields = 4,
  area = false,
}: {
  groups?: number;
  fields?: number;
  area?: boolean;
}) {
  return (
    <div className="grid gap-8">
      {Array.from({ length: groups }, (_, group) => (
        <div key={group} className={clsx(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <Skeleton className="h-6 w-44 sm:col-span-2" />
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="grid gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-11 rounded-lg" />
            </div>
          ))}
          {area && <Skeleton className="h-28 rounded-lg sm:col-span-2" />}
        </div>
      ))}
      <Skeleton className="h-11 w-32 rounded-lg" />
    </div>
  );
}

/** Collapsed cards with a name and a status, like rooms and experiences. */
export function SkCollapsed({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={clsx(card, "flex items-center justify-between gap-3 p-5")}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A table card: a header row and lines. */
export function SkTable({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className={clsx(card, "overflow-hidden")}>
      {Array.from({ length: rows + 1 }, (_, row) => (
        <div key={row} className="flex gap-6 border-b border-line px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={clsx(row === 0 ? "h-3" : "h-4", column === 0 ? "w-40" : "w-16")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The calendar: toolbar, filters, a six-week month grid, and the day panel beside it. */
export function SkCalendar() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className={card}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="me-auto h-6 w-40" />
          <Skeleton className="h-9 w-52 rounded-full" />
        </div>
        <div className="flex gap-2 border-b border-line px-4 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-32 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-7 border-b border-line">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex justify-center py-2">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, index) => (
            <div key={index} className="min-h-24 border-e border-b border-line p-1.5 sm:min-h-28">
              <Skeleton className="ms-auto size-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <SkPanel lines={6} />
        <SkPanel lines={3} />
      </div>
    </div>
  );
}

/** Pill tabs, as on Bookings. */
export function SkTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-fit gap-1 rounded-full bg-surface-2 p-1">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-8 w-24 rounded-full" />
      ))}
    </div>
  );
}

/** A grid of photo or option tiles. */
export function SkPhotoTiles({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
      ))}
    </div>
  );
}
