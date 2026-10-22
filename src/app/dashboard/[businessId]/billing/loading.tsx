import { SkHeader, SkPanel, SkTiles } from "@/components/shell/skeletons";

/** Billing: usage and the three plans. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader />
      <SkTiles count={3} />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkPanel key={index} lines={6} />
        ))}
      </div>
    </div>
  );
}
