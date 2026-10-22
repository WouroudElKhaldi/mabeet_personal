import { SkHeader, SkRows, SkTabs } from "@/components/shell/skeletons";

/** Bookings: tabs and booking cards. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader intro={false} />
      <SkTabs />
      <SkRows count={5} tall />
    </div>
  );
}
