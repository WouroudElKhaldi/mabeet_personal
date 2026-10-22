import { SkForm, SkHeader } from "@/components/shell/skeletons";

/** Profile: details and password. */
export default function Loading() {
  return (
    <div className="max-w-3xl">
      <SkHeader />
      <SkForm groups={2} fields={2} />
    </div>
  );
}
