import { SkHeader } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Assistant: chat tools, ideas and the message box. */
export default function Loading() {
  return (
    <div className="grid gap-6">
      <SkHeader />
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  );
}
