import { SkFeed, SkHeader, SkPanel, SkRows } from "@/components/shell/skeletons";

/** AI keys: the new-key form, keys and the call log. */
export default function Loading() {
  return (
    <div className="grid gap-10">
      <SkHeader />
      <SkPanel lines={3} />
      <SkRows count={2} avatar={false} />
      <SkFeed count={5} />
    </div>
  );
}
