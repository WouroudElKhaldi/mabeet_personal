import { SkForm, SkHeader } from "@/components/shell/skeletons";

/** Settings: money, holds and payments. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkForm groups={2} fields={4} area />
    </div>
  );
}
