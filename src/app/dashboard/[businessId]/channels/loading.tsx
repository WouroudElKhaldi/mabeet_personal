import { SkHeader, SkPanel } from "@/components/shell/skeletons";

/** Channels: a card per room with its links. */
export default function Loading() {
  return (
    <div className="grid gap-8">
      <SkHeader />
      {Array.from({ length: 2 }, (_, index) => (
        <SkPanel key={index} lines={5} />
      ))}
    </div>
  );
}
