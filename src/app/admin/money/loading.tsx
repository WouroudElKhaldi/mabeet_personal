import { SkHeader, SkRows, SkTable, SkTiles } from "@/components/shell/skeletons";

/** Money: earnings, payouts to send, what's owed. */
export default function Loading() {
  return (
    <div className="grid gap-10">
      <SkHeader />
      <SkTiles />
      <SkRows count={2} avatar={false} />
      <SkTable rows={5} columns={5} />
    </div>
  );
}
