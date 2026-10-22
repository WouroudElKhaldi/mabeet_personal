import { clsx } from "clsx";

/** A shimmering placeholder block. Decorative: screen readers hear the page's own loading status instead. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton rounded-md", className)} />;
}

/** Placeholder for the listing grid: square photos and three text lines, like the real cards. */
export function CardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="mt-3 h-4 w-4/5" />
          <Skeleton className="mt-2 h-3.5 w-1/2" />
          <Skeleton className="mt-2 h-3.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Tabs, the search pill and the category row, as on the home and search pages. */
export function BrowseHeaderSkeleton() {
  return (
    <div className="grid justify-items-center gap-6 pt-6">
      <div className="flex gap-8">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-20" />
        ))}
      </div>
      <Skeleton className="h-16 w-full max-w-208 rounded-full" />
      <div className="flex w-full gap-8 border-b border-line pb-4">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="grid shrink-0 justify-items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A place or experience page: title, photo block, text column and the booking card. */
export function ListingPageSkeleton() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-6 aspect-[2/1] max-h-120 w-full rounded-2xl max-sm:aspect-[4/3]" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="grid content-start gap-3">
          <Skeleton className="h-12 w-64 rounded-full" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="grid gap-2">
                <Skeleton className="size-6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    </div>
  );
}
