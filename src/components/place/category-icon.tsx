import {
  Castle,
  Grape,
  House,
  type LucideIcon,
  Mountain,
  MountainSnow,
  Tent,
  TreePine,
  Waves,
  Wheat,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  mountain: Mountain,
  beach: Waves,
  countryside: Wheat,
  "old-town": Castle,
  guesthouse: House,
  cabin: TreePine,
  camping: Tent,
  vineyard: Grape,
  ski: MountainSnow,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? House;
  return <Icon className={className} aria-hidden strokeWidth={1.6} />;
}
