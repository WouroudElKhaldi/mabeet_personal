import { SkHeader, SkTable } from "@/components/shell/skeletons";

/** Hosts: the table. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkTable rows={8} columns={5} />
    </div>
  );
}
