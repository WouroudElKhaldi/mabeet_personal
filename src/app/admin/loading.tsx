import { SkHeader, SkPanel, SkTiles } from "@/components/shell/skeletons";

/** Admin overview: tiles, what needs attention, newest businesses. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkTiles />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SkPanel lines={5} />
        <SkPanel lines={6} />
      </div>
    </div>
  );
}
