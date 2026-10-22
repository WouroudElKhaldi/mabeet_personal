import { SkForm, SkHeader, SkPanel, SkTiles2 } from "@/components/shell/skeletons";

/** Your place: description, photos and details. */
export default function Loading() {
  return (
    <div className="grid gap-6">
      <SkHeader action />
      <SkPanel lines={6} />
      <div className="rounded-xl bg-surface p-5 ring-1 ring-line">
        <SkTiles2 count={6} className="lg:grid-cols-5" />
      </div>
      <SkForm groups={3} fields={4} />
    </div>
  );
}
