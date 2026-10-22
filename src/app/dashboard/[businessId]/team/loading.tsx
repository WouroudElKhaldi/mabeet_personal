import { SkHeader, SkPanel, SkRows } from "@/components/shell/skeletons";

/** Team: members and roles. */
export default function Loading() {
  return (
    <div className="grid gap-12">
      <SkHeader intro={false} />
      <SkRows count={3} />
      <SkPanel lines={5} />
    </div>
  );
}
