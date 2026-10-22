import { SkCollapsed, SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Rooms: collapsed room cards and the new-room form. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader intro={false} />
      <SkCollapsed count={3} />
      <SkPanel lines={5} />
    </div>
  );
}
