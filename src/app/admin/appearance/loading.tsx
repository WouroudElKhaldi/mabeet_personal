import { SkHeader, SkTiles2 } from "@/components/shell/skeletons";

/** Appearance: the palette cards. */
export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkTiles2 count={5} />
    </div>
  );
}
