import { SkForm, SkHeader, SkRows, SkTiles } from "@/components/shell/skeletons";

/** Payouts: balances, the request form and history. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader />
      <SkTiles count={3} />
      <SkForm groups={1} fields={4} />
      <SkRows count={3} avatar={false} />
    </div>
  );
}
