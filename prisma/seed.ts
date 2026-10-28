/**
 * Local demo data. Every place here is fictional and marked as a demo listing.
 * Run with `pnpm db:seed`. Safe to re-run: it skips anything that already exists.
 */
import { prisma } from "../src/server/db/client";
import { auth } from "../src/server/auth/better-auth";
import { secureToken } from "../src/lib/tokens";
import { createWorkspace } from "../src/server/services/onboarding-service";
import { seedHistory } from "./seed-history";
import { KIND_CATEGORIES, seedOfferings, seedPlaceDetails } from "./seed-offerings";

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
  /** Unsplash photo ids. Stock photos, labelled as such: they are not the real place. */
  photos: string[];
  rooms: Array<{
    name: string;
    capacity: number;
    beds: number;
    /** 1 unless given. */
    bedrooms?: number;
    bathrooms?: number;
    rate: number;
    amenities: string[];
    description: string;
  }>;
}

const PLACES: DemoPlace[] = [
  {
    name: "Dar Al Sindiyan (demo)",
    photos: [
      "1499696010180-025ef6e1a8f9",
      "1505693416388-ac5ce068fe85",
      "1464822759023-fed622ff2c3b",
      "1522708323590-d24dbb6b0267",
      "1544984243-ec57ea16fe25",
    ],
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
    photos: [
      "1520250497591-112f2f40a3f4",
      "1582719478250-c89cae4dc85b",
      "1571896349842-33c89424de2d",
      "1590490360182-c33d57733427",
      "1501785888041-af3ef285b470",
    ],
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
    photos: [
      "1449844908441-8829872d2607",
      "1510798831971-661eb04b3739",
      "1518780664697-55e3ad937233",
      "1587061949409-02df41d5e562",
      "1595521624992-48a59aef95e3",
    ],
    area: "Tannourine",
    description:
      "A timber cabin at the edge of the cedar forest, with a wood stove and trails from the door.\n\nDemo listing for testing.",
    categories: ["cabin", "mountain"],
    rooms: [
      {
        name: "The cabin",
        capacity: 4,
        beds: 2,
        bedrooms: 2,
        bathrooms: 1,
        rate: 11000,
        amenities: ["fireplace", "jacuzzi", "kitchen", "parking", "pets"],
        description: "Whole cabin, sleeps four: two bedrooms, a bathroom and an indoor jacuzzi.",
      },
    ],
  },
  {
    name: "Beit Ghazir (demo)",
    photos: [
      "1570129477492-45c003edd2be",
      "1493809842364-78817add7ffb",
      "1502672260266-1c1ef2d93688",
      "1596394516093-501ba68a0ba6",
      "1542314831-068cd1dbfeeb",
    ],
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
    photos: [
      "1512917774080-9991f1c4c750",
      "1566073771259-6a8506099945",
      "1600585154340-be6161a56a0c",
      "1551882547-ff40c63fe5fa",
      "1613490493576-7fde63acd811",
    ],
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
    photos: [
      "1600596542815-ffad4c1539a9",
      "1568605114967-8130f3a36994",
      "1564013799919-ab600027ffc6",
      "1464822759023-fed622ff2c3b",
      "1501785888041-af3ef285b470",
    ],
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
  // Demo accounts are verified up front, so they can sign in even when email verification is required.
  return prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
}

const stockPhotoUrl = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=75`;

/** Adds stock photos to a demo place that has none yet, so re-running the seed fills older databases too. */
async function ensurePhotos(businessId: string, place: DemoPlace) {
  if ((await prisma.photo.count({ where: { businessId } })) > 0) return;
  await prisma.photo.createMany({
    data: place.photos.map((id, position) => ({
      businessId,
      url: stockPhotoUrl(id),
      alt: `${place.name}, stock photo`,
      position,
    })),
  });
}

/**
 * Demo photos are stock pictures in the same order for every place (outside, a bedroom, a view, a living room,
 * an outdoor space), so the photo tour has parts to show. Only fills photos nobody has labelled yet.
 */
const DEMO_PHOTO_AREAS = ["EXTERIOR", "BEDROOM", null, "LIVING_ROOM", "TERRACE"] as const;

async function ensurePhotoAreas() {
  for (const [position, area] of DEMO_PHOTO_AREAS.entries()) {
    if (!area) continue;
    await prisma.photo.updateMany({
      where: { position, area: null, roomId: null, offeringId: null, alt: { endsWith: "stock photo" } },
      data: { area },
    });
  }
}

/** Brings an already seeded demo place's rooms up to date (layout, amenities), so reseeding applies changes here. */
async function ensureRoomLayouts(businessId: string, place: DemoPlace) {
  for (const room of place.rooms) {
    await prisma.room.updateMany({
      where: { businessId, name: room.name },
      data: {
        bedrooms: room.bedrooms ?? 1,
        bathrooms: room.bathrooms ?? 1,
        amenities: room.amenities,
        description: room.description,
      },
    });
  }
}

async function seedPlace(place: DemoPlace, ownerId: string) {
  const existing = await prisma.business.findFirst({ where: { name: place.name } });
  if (existing) {
    await ensureRoomLayouts(existing.id, place);
    return ensurePhotos(existing.id, place);
  }
  const business = await createWorkspace(ownerId, { name: place.name, area: place.area });
  await prisma.business.update({
    where: { id: business.id },
    data: {
      description: place.description,
      listedPublicly: true,
      // Demo places show every feature, AI included.
      plan: "PRO",
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
          bedrooms: room.bedrooms ?? 1,
          bathrooms: room.bathrooms ?? 1,
          baseRateCents: room.rate,
          amenities: room.amenities,
          exportToken: secureToken(),
        })),
      },
    },
  });
  await ensurePhotos(business.id, place);
}

/** A front-desk staff member at the first demo place, so roles can be tried without setting anything up. */
async function seedFrontDeskStaff(password: string) {
  const staff = await ensureUser("staff@mabeet.test", "Demo Front Desk", password);
  const business = await prisma.business.findFirstOrThrow({ where: { name: PLACES[0]!.name } });
  const role = await prisma.role.findFirstOrThrow({ where: { businessId: business.id, name: "Front desk" } });
  await prisma.membership.upsert({
    where: { userId_businessId: { userId: staff.id, businessId: business.id } },
    create: { userId: staff.id, businessId: business.id, roleId: role.id },
    update: { roleId: role.id, status: "ACTIVE" },
  });
}

/** Demo ways for hosts to pay Mabeet by hand, so the billing pages show the flow. Replace with real details. */
async function seedPaymentOptions() {
  if ((await prisma.platformPaymentOption.count()) > 0) return;
  await prisma.platformPaymentOption.createMany({
    data: [
      {
        method: "BANK_TRANSFER",
        label: "Demo bank account (USD)",
        details: [
          "Account holder: Mabeet SAL",
          "IBAN: LB00 0000 0000 0000 0000 0000 0000",
          "SWIFT: DEMOLBBE",
        ].join("\n"),
        position: 0,
      },
      { method: "WHISH", label: "Whish Money", details: "+961 70 000 000 (Mabeet)", position: 1 },
      { method: "CRYPTO", label: "USDT (TRC-20)", details: "TDemoWalletAddressReplaceMe000000", position: 2 },
      {
        method: "CASH",
        label: "Cash at our office",
        details: "Hamra, Beirut · Mon to Fri, 9:00 to 17:00",
        position: 3,
      },
    ],
  });
}

async function main() {
  const categories = [
    ...CATEGORIES.map((category) => ({ ...category, kind: "HOME" as const })),
    ...KIND_CATEGORIES.map((category) => ({ ...category, icon: category.slug })),
  ].map((category, position) => ({ ...category, position }));
  await prisma.$transaction(
    categories.map((category) =>
      prisma.category.upsert({ where: { slug: category.slug }, create: category, update: category }),
    ),
  );

  const password = process.env.SEED_PASSWORD ?? "demo-password-123";
  const admin = await ensureUser("admin@mabeet.test", "Platform Admin", password);
  await prisma.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
  const host = await ensureUser("host@mabeet.test", "Demo Host", password);
  await ensureUser("guest@mabeet.test", "Demo Guest", password);

  for (const place of PLACES) await seedPlace(place, host.id);
  await seedFrontDeskStaff(password);
  await seedPlaceDetails();
  const offerings = await seedOfferings();
  const history = await seedHistory();
  await seedPaymentOptions();
  await ensurePhotoAreas();
  console.log(
    `Seeded ${categories.length} categories, ${PLACES.length} demo places, ${offerings} experiences and services, and ${history} demo bookings.`,
  );
  console.log(
    "Sign in as host@mabeet.test, staff@mabeet.test, guest@mabeet.test or admin@mabeet.test (password: SEED_PASSWORD).",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
