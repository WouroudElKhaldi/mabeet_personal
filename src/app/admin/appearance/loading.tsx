import { SkHeader, SkPhotoTiles } from "@/components/shell/skeletons";

/** Appearance: the palette cards. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkPhotoTiles count={5} />
    </div>
  );
}
