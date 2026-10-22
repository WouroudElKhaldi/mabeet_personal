import { SkHeader, SkPanel, SkTiles } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Analytics: filters, eight tiles, four charts and the report box. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <Skeleton className="mb-8 h-20 rounded-xl" />
      <div className="grid gap-3">
        <SkTiles />
        <SkTiles />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <SkPanel key={index} lines={5} />
        ))}
      </div>
      <SkPanel lines={4} className="mt-10" />
    </div>
  );
}
