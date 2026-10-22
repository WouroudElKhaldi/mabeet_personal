import { SkFeed, SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Notifications: the list and phone alerts. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SkFeed />
        <SkPanel lines={3} />
      </div>
    </div>
  );
}
