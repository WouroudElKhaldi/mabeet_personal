import { SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Reviews: review cards. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader intro={false} />
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <SkPanel key={index} lines={2} />
        ))}
      </div>
    </div>
  );
}
