import { LoadingStatus } from "@/components/ui/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

/** The boarding pass page: heading, three steps and the pass itself. */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <LoadingStatus />
      <div>
        <Skeleton className="h-10 w-4/5" />
        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-8 h-24 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
