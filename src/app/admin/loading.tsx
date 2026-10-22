import { LoadingStatus } from "@/components/ui/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <LoadingStatus />
      <Skeleton className="h-10 w-48" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-80 rounded-xl" />
    </div>
  );
}
