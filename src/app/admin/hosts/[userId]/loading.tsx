import { SkHeader, SkPanel } from "@/components/shell/skeletons";

/** One host: profile and businesses. */
export default function Loading() {
  return (
    <div>
      <SkHeader intro={false} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <SkPanel lines={7} />
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkPanel key={index} lines={2} />
          ))}
        </div>
      </div>
    </div>
  );
}
