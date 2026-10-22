import { LoadingStatus } from "@/components/ui/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <LoadingStatus />
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-4 rounded-xl p-4 ring-1 ring-line">
          <Skeleton className="size-20 shrink-0 rounded-md" />
          <div className="grid flex-1 content-center gap-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
