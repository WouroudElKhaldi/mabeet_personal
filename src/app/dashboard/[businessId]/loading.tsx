import { SkHeader, SkPanel, SkRows, SkTiles } from "@/components/shell/skeletons";

/** Today: tiles, savings, requests and charts. */
export default function Loading() {
  return (
    <div className="grid gap-10">
      <SkHeader />
      <SkTiles />
      <div className="rounded-xl bg-surface p-5 ring-1 ring-line">
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
