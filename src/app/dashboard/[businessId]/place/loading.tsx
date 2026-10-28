import { SkForm, SkHeader, SkPanel, SkPhotoTiles } from "@/components/shell/skeletons";
import { panelClass } from "@/components/ui/field";

/** Your place: description, photos and details. */
export default function Loading() {
  return (
    <div className="grid gap-6">
      <SkHeader action />
      <SkPanel lines={6} />
      <div className={panelClass}>
        <SkPhotoTiles count={6} className="lg:grid-cols-5" />
      </div>
      <SkForm groups={3} fields={4} />
    </div>
  );
}
