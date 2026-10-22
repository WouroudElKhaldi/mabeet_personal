import { SkHeader, SkRows } from "@/components/shell/skeletons";

/** Categories: the list. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkRows count={6} />
    </div>
  );
}
