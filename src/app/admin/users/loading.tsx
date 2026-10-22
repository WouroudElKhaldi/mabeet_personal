import { SkHeader } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Users: two columns of cards. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
