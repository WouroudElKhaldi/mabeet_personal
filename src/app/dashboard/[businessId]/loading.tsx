import { SkHeader, SkPanel, SkRows, SkTiles } from "@/components/shell/skeletons";
import { panelClass } from "@/components/ui/field";

/** Today: tiles, savings, requests and charts. */
export default function Loading() {
  return (
    <div className="grid gap-10">
      <SkHeader />
      <SkTiles />
      <div className={panelClass}>
        <SkTiles />
      </div>
      <SkRows count={3} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SkPanel lines={8} />
        <SkPanel lines={6} />
      </div>
    </div>
  );
}
