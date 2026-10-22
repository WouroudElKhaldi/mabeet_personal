import { LoadingStatus } from "@/components/ui/loading-status";
import { BrowseHeaderSkeleton, CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Home and search: tabs, search, categories and a grid of cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-360 px-4 sm:px-6 lg:px-10">
      <LoadingStatus />
      <BrowseHeaderSkeleton />
      <Skeleton className="mt-10 mb-4 h-6 w-48" />
      <CardGridSkeleton />
    </div>
  );
}
