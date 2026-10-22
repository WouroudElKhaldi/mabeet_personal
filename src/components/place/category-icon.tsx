import {
  Camera,
  Car,
  Castle,
  ChefHat,
  Flower2,
  Footprints,
  Grape,
  House,
  Landmark,
  type LucideIcon,
  Map,
  Mountain,
  MountainSnow,
  Palette,
  Sailboat,
  Tent,
  TreePine,
  Waves,
  Wheat,
  Wine,
} from "lucide-react";
import { CATEGORY_ICONS, type CategoryIconName } from "@/config/category-icons";

const ICONS: Record<CategoryIconName, LucideIcon> = {
  // Homes
  mountain: Mountain,
  beach: Waves,
  countryside: Wheat,
  "old-town": Castle,
  guesthouse: House,
  cabin: TreePine,
  camping: Tent,
  vineyard: Grape,
  ski: MountainSnow,
  // Experiences
  hiking: Footprints,
  "food-wine": Wine,
  culture: Landmark,
  water: Sailboat,
  workshops: Palette,
  // Services
  transfers: Car,
  "private-chef": ChefHat,
  guides: Map,
  photography: Camera,
  wellness: Flower2,
};

const isIconName = (value: string | undefined): value is CategoryIconName =>
  value !== undefined && (CATEGORY_ICONS as readonly string[]).includes(value);

/** A category's icon, by its stored icon name; the slug is the fallback for older rows. */
export function CategoryIcon({ slug, icon, className }: { slug: string; icon?: string; className?: string }) {
  const name = isIconName(icon) ? icon : isIconName(slug) ? slug : null;
  const Icon = name ? ICONS[name] : House;
  return <Icon className={className} aria-hidden strokeWidth={1.6} />;
}
