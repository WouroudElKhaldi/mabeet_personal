import { SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Health: sync and AI. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkPanel lines={6} />
        <SkPanel lines={5} />
      </div>
    </div>
  );
}
