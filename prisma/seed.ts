/**
 * Local demo data. Every place here is fictional and marked as a demo listing.
 * Run with `pnpm db:seed`. Safe to re-run: it skips anything that already exists.
 */
import { prisma } from "../src/server/db/client";
import { auth } from "../src/server/auth/better-auth";
import { secureToken } from "../src/lib/tokens";
import { createWorkspace } from "../src/server/services/onboarding-service";

const CATEGORIES = [
  { slug: "mountain", nameEn: "Mountain", nameAr: "جبل", icon: "mountain" },
  { slug: "beach", nameEn: "By the sea", nameAr: "على البحر", icon: "beach" },
  { slug: "countryside", nameEn: "Countryside", nameAr: "ريف", icon: "countryside" },
  { slug: "old-town", nameEn: "Old town", nameAr: "بلدة قديمة", icon: "old-town" },
  { slug: "guesthouse", nameEn: "Guesthouse", nameAr: "بيت ضيافة", icon: "guesthouse" },
  { slug: "cabin", nameEn: "Cabin", nameAr: "كوخ", icon: "cabin" },
  { slug: "camping", nameEn: "Camping", nameAr: "تخييم", icon: "camping" },
  { slug: "vineyard", nameEn: "Vineyard", nameAr: "كرم", icon: "vineyard" },
  { slug: "ski", nameEn: "Ski", nameAr: "تزلّج", icon: "ski" },
];

interface DemoPlace {
  name: string;
  area: string;
  description: string;
  categories: string[];
  rooms: Array<{
    name: string;
    capacity: number;
    beds: number;
    rate: number;
    amenities: string[];
    description: string;
  }>;
}

const PLACES: DemoPlace[] = [
  {
    name: "Dar Al Sindiyan (demo)",
    area: "Chouf",
    description:
      "A restored 19th-century stone house under oak trees, ten minutes from the cedar reserve. Breakfast is made from the garden.\n\nDemo listing for testing.",
    categories: ["mountain", "guesthouse"],
    rooms: [
      {
        name: "Arched room",
        capacity: 2,
        beds: 1,
        rate: 9500,
        amenities: ["wifi", "breakfast", "heating", "view"],
        description: "Vaulted ceiling, a window on the valley.",
      },
      {
        name: "Family loft",
        capacity: 4,
        beds: 3,
        rate: 14000,
        amenities: ["wifi", "breakfast", "heating", "kitchen"],
        description: "Two levels, a small kitchen.",
      },
    ],
  },
  {
    name: "Bayt El Bahr (demo)",
    area: "Batroun",
    description:
      "Three rooms facing the old harbour, a rooftop for sunsets and the souk around the corner.\n\nDemo listing for testing.",
    categories: ["beach", "old-town"],
    rooms: [
      {
        name: "Sea room",
        capacity: 2,
        beds: 1,
        rate: 12000,
        amenities: ["wifi", "ac", "view", "generator"],
        description: "Balcony over the water.",
      },
      {
        name: "Courtyard room",
        capacity: 3,
        beds: 2,
        rate: 9000,
        amenities: ["wifi", "ac", "generator"],
        description: "Quiet, opens on the lemon tree.",
      },
    ],
  },
  {
    name: "Kroum Cabin (demo)",
    area: "Tannourine",
    description:
      "A timber cabin at the edge of the cedar forest, with a wood stove and trails from the door.\n\nDemo listing for testing.",
    categories: ["cabin", "mountain"],
    rooms: [
      {
        name: "The cabin",
        capacity: 4,
        beds: 2,
        rate: 11000,
        amenities: ["fireplace", "kitchen", "parking", "pets"],
        description: "Whole cabin, sleeps four.",
      },
    ],
  },
  {
    name: "Beit Ghazir (demo)",
    area: "Ehden",
    description:
      "A family guesthouse on the main square, known for its mezze breakfast and hiking maps.\n\nDemo listing for testing.",
    categories: ["mountain", "guesthouse", "old-town"],
    rooms: [
      {
        name: "Square view",
        capacity: 2,
        beds: 1,
        rate: 8500,
        amenities: ["wifi", "breakfast", "view"],
        description: "Overlooks the square.",
      },
      {
        name: "Garden twin",
        capacity: 2,
        beds: 2,
        rate: 8000,
        amenities: ["wifi", "breakfast", "garden"],
        description: "Two single beds, garden side.",
      },
    ],
  },
  {
    name: "Karm Sunset (demo)",
    area: "West Bekaa",
    description:
      "Rooms between the vines, wine tastings in the cellar and long tables at harvest.\n\nDemo listing for testing.",
    categories: ["vineyard", "countryside"],
    rooms: [
      {
        name: "Vine room",
        capacity: 2,
        beds: 1,
        rate: 13000,
        amenities: ["wifi", "ac", "breakfast", "pool"],
        description: "Terrace on the vines.",
      },
    ],
  },
  {
    name: "Faraya Snow Lodge (demo)",
    area: "Faraya",
    description:
      "Ten minutes from the slopes, with a drying room for gear and a fireplace lounge.\n\nDemo listing for testing.",
    categories: ["ski", "mountain"],
    rooms: [
      {
        name: "Lodge suite",
        capacity: 4,
        beds: 2,
        rate: 15000,
        amenities: ["fireplace", "heating", "parking", "generator"],
        description: "Two bedrooms, one lounge.",
      },
    ],
  },
];

async function ensureUser(email: string, name: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const { user } = await auth.api.signUpEmail({ body: { email, name, password } });
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

async function seedPlace(place: DemoPlace, ownerId: string) {
  if (await prisma.business.findFirst({ where: { name: place.name } })) return;
  const business = await createWorkspace(ownerId, { name: place.name, area: place.area });
  await prisma.business.update({
    where: { id: business.id },
    data: {
      description: place.description,
      listedPublicly: true,
      whatsapp: "+96170000000",
      depositInstructions: "Send the deposit by Whish to 70 000 000 (demo), with your booking reference.",
      houseRules: "No parties. Quiet after 11 pm.",
      cancellationPolicy: "Free cancellation up to 7 days before arrival. After that the deposit is kept.",
      categories: { create: place.categories.map((categorySlug) => ({ categorySlug })) },
      rooms: {
        create: place.rooms.map((room) => ({
          name: room.name,
          description: room.description,
          capacity: room.capacity,
          beds: room.beds,
          baseRateCents: room.rate,
          amenities: room.amenities,
          exportToken: secureToken(),
        })),
      },
    },
  });
}

async function main() {
  await prisma.$transaction(
    CATEGORIES.map((category) =>
      prisma.category.upsert({ where: { slug: category.slug }, create: category, update: category }),
    ),
  );

  const password = process.env.SEED_PASSWORD ?? "demo-password-123";
  const admin = await ensureUser("admin@mabeet.test", "Platform Admin", password);
  await prisma.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
  const host = await ensureUser("host@mabeet.test", "Demo Host", password);
  await ensureUser("guest@mabeet.test", "Demo Guest", password);

  for (const place of PLACES) await seedPlace(place, host.id);
  console.log(`Seeded ${CATEGORIES.length} categories and ${PLACES.length} demo places.`);
  console.log(
    "Sign in as host@mabeet.test, guest@mabeet.test or admin@mabeet.test (password: SEED_PASSWORD).",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
