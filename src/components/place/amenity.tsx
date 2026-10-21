import {
  Car,
  Coffee,
  Flame,
  Mountain,
  PawPrint,
  type LucideIcon,
  Snowflake,
  Sun,
  TreeDeciduous,
  Utensils,
  WavesLadder,
  Wifi,
  Zap,
} from "lucide-react";
import type { AmenityKey } from "@/config/amenities";

const ICONS: Record<AmenityKey, LucideIcon> = {
  wifi: Wifi,
  parking: Car,
  breakfast: Coffee,
  ac: Snowflake,
  heating: Sun,
  fireplace: Flame,
  pool: WavesLadder,
  kitchen: Utensils,
  view: Mountain,
  garden: TreeDeciduous,
  pets: PawPrint,
  generator: Zap,
};

export function Amenity({ name, label }: { name: AmenityKey; label: string }) {
  const Icon = ICONS[name];
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon className="size-5 text-muted" aria-hidden strokeWidth={1.6} />
      <span>{label}</span>
    </li>
  );
}
