import { SkCollapsed, SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Experiences: collapsed cards. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader />
      <SkCollapsed count={3} />
      <SkPanel lines={4} />
    </div>
  );
}
