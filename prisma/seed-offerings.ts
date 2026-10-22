/**
 * Demo experiences and services, with sessions for the coming weeks, plus "Things to know" details and
 * map positions for the demo places. Everything is fictional and labelled as demo; photos are stock.
 */
import type { ActivityLevel, ListingKind, PriceUnit, SkillLevel } from "@prisma/client";
import { prisma } from "../src/server/db/client";

export const KIND_CATEGORIES: Array<{ slug: string; kind: ListingKind; nameEn: string; nameAr: string }> = [
  { slug: "hiking", kind: "EXPERIENCE", nameEn: "Hiking", nameAr: "مشي جبلي" },
  { slug: "food-wine", kind: "EXPERIENCE", nameEn: "Food & wine", nameAr: "أكل ونبيذ" },
  { slug: "culture", kind: "EXPERIENCE", nameEn: "Culture & history", nameAr: "ثقافة وتاريخ" },
  { slug: "water", kind: "EXPERIENCE", nameEn: "On the water", nameAr: "على الماء" },
  { slug: "workshops", kind: "EXPERIENCE", nameEn: "Workshops", nameAr: "ورش عمل" },
  { slug: "transfers", kind: "SERVICE", nameEn: "Transfers", nameAr: "تنقّلات" },
  { slug: "private-chef", kind: "SERVICE", nameEn: "Private chef", nameAr: "طاهٍ خاص" },
  { slug: "guides", kind: "SERVICE", nameEn: "Local guides", nameAr: "مرشدون محليّون" },
  { slug: "photography", kind: "SERVICE", nameEn: "Photography", nameAr: "تصوير" },
  { slug: "wellness", kind: "SERVICE", nameEn: "Wellness", nameAr: "عناية واسترخاء" },
];

/** Map position and "Things to know" for each demo place, applied on every seed run. */
const PLACE_DETAILS: Record<
  string,
  { latitude: number; longitude: number; tags: string[]; accessibility: string[]; minGuestAge?: number }
> = {
  "Dar Al Sindiyan (demo)": {
    latitude: 33.6969,
    longitude: 35.5636,
    tags: ["historic", "quiet", "local-food", "hiking-nearby"],
    accessibility: ["step-free-access", "disabled-parking"],
  },
  "Bayt El Bahr (demo)": {
    latitude: 34.2553,
    longitude: 35.6581,
    tags: ["sea-view", "romantic", "historic"],
    accessibility: [],
    minGuestAge: 12,
  },
  "Kroum Cabin (demo)": {
    latitude: 34.2086,
    longitude: 35.9283,
    tags: ["pet-friendly", "hiking-nearby", "mountain-view", "eco-friendly", "quiet"],
    accessibility: [],
  },
  "Beit Ghazir (demo)": {
    latitude: 34.2914,
    longitude: 35.9947,
    tags: ["family-friendly", "local-food", "hiking-nearby"],
    accessibility: ["step-free-access", "step-free-bathroom", "wide-doorways"],
  },
  "Karm Sunset (demo)": {
    latitude: 33.6436,
    longitude: 35.7311,
    tags: ["romantic", "local-food", "work-friendly"],
    accessibility: ["step-free-access", "step-free-bathroom", "disabled-parking", "flat-ground"],
  },
  "Faraya Snow Lodge (demo)": {
    latitude: 34.0047,
    longitude: 35.8239,
    tags: ["group-friendly", "family-friendly", "mountain-view"],
    accessibility: ["disabled-parking"],
  },
};

interface DemoOffering {
  host: string;
  kind: ListingKind;
  slug: string;
  title: string;
  description: string;
  category: string;
  area: string;
  meetingPoint: string;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  price: number;
  priceUnit: PriceUnit;
  maxGuests: number;
  minAge?: number;
  activityLevel?: ActivityLevel;
  skillLevel?: SkillLevel;
  included: string[];
  notIncluded: string[];
  accessibility: string[];
  languages: string[];
  tags: string[];
  cancellationHours: number;
  /** Weekdays (0 = Sunday) and Beirut local start times. */
  schedule: { days: number[]; times: string[] };
  photos: string[];
}

const OFFERINGS: DemoOffering[] = [
  {
    host: "Dar Al Sindiyan (demo)",
    kind: "EXPERIENCE",
    slug: "cedar-ridge-sunrise-hike-demo",
    title: "Cedar ridge sunrise hike (demo)",
    description:
      "Start in the dark, reach the ridge as the sun comes up over the Bekaa, and walk down through the cedars to breakfast at the house.\n\nDemo listing for testing.",
    category: "hiking",
    area: "Chouf",
    meetingPoint: "Barouk cedar reserve gate",
    latitude: 33.6936,
    longitude: 35.6904,
    durationMinutes: 240,
    price: 3500,
    priceUnit: "PER_PERSON",
    maxGuests: 12,
    minAge: 12,
    activityLevel: "MODERATE",
    skillLevel: "BEGINNER",
    included: ["Head torches", "Breakfast at the house", "A local mountain guide"],
    notIncluded: ["Transport to the trailhead", "Hiking shoes"],
    accessibility: [],
    languages: ["ar", "en", "fr"],
    tags: ["hiking-nearby", "mountain-view", "eco-friendly"],
    cancellationHours: 24,
    schedule: { days: [6, 0], times: ["05:30"] },
    photos: ["1551632811-561732d1e306", "1501555088652-021faa106b9b", "1476514525535-07fb3b4ae5f1"],
  },
  {
    host: "Bayt El Bahr (demo)",
    kind: "EXPERIENCE",
    slug: "batroun-sunset-kayak-demo",
    title: "Sunset kayak along the Batroun coast (demo)",
    description:
      "Paddle past the Phoenician sea wall and the old harbour while the sun goes down, with a swim stop at a quiet cove.\n\nDemo listing for testing.",
    category: "water",
    area: "Batroun",
    meetingPoint: "Batroun old harbour",
    latitude: 34.2557,
    longitude: 35.6557,
    durationMinutes: 120,
    price: 4000,
    priceUnit: "PER_PERSON",
    maxGuests: 8,
    minAge: 14,
    activityLevel: "MODERATE",
    skillLevel: "BEGINNER",
    included: ["Kayak, paddle and life jacket", "Dry bag", "Fresh lemonade"],
    notIncluded: ["Towels", "Transport"],
    accessibility: [],
    languages: ["ar", "en"],
    tags: ["sea-view", "romantic"],
    cancellationHours: 24,
    schedule: { days: [5, 6, 0], times: ["17:00"] },
    photos: ["1530866495561-507c9faab2ed", "1500530855697-b586d89ba3ee", "1469854523086-cc02fe5d8800"],
  },
  {
    host: "Karm Sunset (demo)",
    kind: "EXPERIENCE",
    slug: "bekaa-cellar-wine-tasting-demo",
    title: "Wine tasting in a Bekaa cellar (demo)",
    description:
      "Taste five wines in the family's stone cellar, then walk the vines with the winemaker. Light bites from the garden.\n\nDemo listing for testing.",
    category: "food-wine",
    area: "West Bekaa",
    meetingPoint: "Karm Sunset cellar door",
    latitude: 33.6436,
    longitude: 35.7311,
    durationMinutes: 90,
    price: 4500,
    priceUnit: "PER_PERSON",
    maxGuests: 16,
    minAge: 21,
    activityLevel: "LIGHT",
    skillLevel: "BEGINNER",
    included: ["Five wines", "Light bites", "A keepsake tasting glass"],
    notIncluded: ["Transport", "Bottles to take home"],
    accessibility: [
      "step-free-access",
      "step-free-bathroom",
      "disabled-parking",
      "flat-ground",
      "low-sensory",
    ],
    languages: ["ar", "en", "fr"],
    tags: ["local-food", "romantic"],
    cancellationHours: 24,
    schedule: { days: [4, 5, 6, 0], times: ["15:00"] },
    photos: ["1510812431401-41d2bd2722f3", "1506377247377-2a5b3b417ebb", "1414235077428-338989a2e8c0"],
  },
  {
    host: "Beit Ghazir (demo)",
    kind: "EXPERIENCE",
    slug: "ehden-mezze-cooking-class-demo",
    title: "Mezze cooking class in Ehden (demo)",
    description:
      "Roll warak enab, pound kebbeh and bake man'oushe with the family, then sit down together to eat what you made.\n\nDemo listing for testing.",
    category: "food-wine",
    area: "Ehden",
    meetingPoint: "Beit Ghazir kitchen",
    latitude: 34.2914,
    longitude: 35.9947,
    durationMinutes: 180,
    price: 5500,
    priceUnit: "PER_PERSON",
    maxGuests: 10,
    minAge: 8,
    activityLevel: "LIGHT",
    skillLevel: "BEGINNER",
    included: ["All ingredients", "Lunch", "Printed recipes in Arabic and English"],
    notIncluded: ["Drinks other than water and tea"],
    accessibility: ["step-free-access", "step-free-bathroom", "wide-doorways"],
    languages: ["ar", "en"],
    tags: ["family-friendly", "local-food"],
    cancellationHours: 48,
    schedule: { days: [6, 0], times: ["11:00"] },
    photos: ["1556910103-1c02745aae4d", "1528712306091-ed0763094c98", "1504674900247-0877df9cc836"],
  },
  {
    host: "Dar Al Sindiyan (demo)",
    kind: "EXPERIENCE",
    slug: "chouf-pottery-workshop-demo",
    title: "Pottery with a Chouf artisan (demo)",
    description:
      "Throw a bowl on the wheel in a village workshop and take it home after firing.\n\nDemo listing for testing.",
    category: "workshops",
    area: "Chouf",
    meetingPoint: "Village workshop, Deir el Qamar",
    latitude: 33.6969,
    longitude: 35.5636,
    durationMinutes: 120,
    price: 3000,
    priceUnit: "PER_PERSON",
    maxGuests: 6,
    activityLevel: "LIGHT",
    skillLevel: "BEGINNER",
    included: ["Clay and glazes", "Firing and pick-up"],
    notIncluded: ["Shipping abroad"],
    accessibility: ["step-free-access"],
    languages: ["ar", "fr"],
    tags: ["family-friendly", "historic"],
    cancellationHours: 24,
    schedule: { days: [3, 6], times: ["14:00"] },
    photos: ["1565193566173-7a0ee3dbe261"],
  },
  {
    host: "Dar Al Sindiyan (demo)",
    kind: "SERVICE",
    slug: "airport-transfer-chouf-demo",
    title: "Airport transfer to the Chouf (demo)",
    description:
      "A driver meets you at Beirut airport arrivals and drives you to the house. Up to four guests and their bags.\n\nDemo listing for testing.",
    category: "transfers",
    area: "Beirut airport",
    meetingPoint: "Arrivals hall, Beirut–Rafic Hariri airport",
    latitude: 33.8209,
    longitude: 35.4884,
    durationMinutes: 90,
    price: 6000,
    priceUnit: "PER_GROUP",
    maxGuests: 4,
    included: ["Meet and greet", "Bottled water", "Waiting time up to 60 minutes"],
    notIncluded: ["Stops on the way"],
    accessibility: ["step-free-access"],
    languages: ["ar", "en", "fr"],
    tags: ["family-friendly", "group-friendly"],
    cancellationHours: 24,
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], times: ["10:00", "18:00"] },
    photos: ["1449965408869-eaa3f722e40d"],
  },
  {
    host: "Bayt El Bahr (demo)",
    kind: "SERVICE",
    slug: "private-chef-dinner-batroun-demo",
    title: "Private chef dinner on the rooftop (demo)",
    description:
      "A four-course seafood dinner cooked for your group on the rooftop, with the sunset over the harbour.\n\nDemo listing for testing.",
    category: "private-chef",
    area: "Batroun",
    meetingPoint: "Bayt El Bahr rooftop",
    latitude: 34.2553,
    longitude: 35.6581,
    durationMinutes: 180,
    price: 22000,
    priceUnit: "PER_GROUP",
    maxGuests: 8,
    included: ["Four courses", "Table setting and service", "Washing up"],
    notIncluded: ["Wine and other drinks"],
    accessibility: [],
    languages: ["ar", "en"],
    tags: ["romantic", "local-food", "group-friendly"],
    cancellationHours: 72,
    schedule: { days: [5, 6], times: ["19:30"] },
    photos: ["1577219491135-ce391730fb2c", "1533105079780-92b9be482077"],
  },
  {
    host: "Bayt El Bahr (demo)",
    kind: "SERVICE",
    slug: "byblos-old-town-guide-demo",
    title: "Byblos old town with a local guide (demo)",
    description:
      "Seven thousand years in two and a half hours: the citadel, the souk and the fishermen's port, with stories you won't find on signs.\n\nDemo listing for testing.",
    category: "guides",
    area: "Byblos",
    meetingPoint: "Byblos citadel entrance",
    latitude: 34.1209,
    longitude: 35.6466,
    durationMinutes: 150,
    price: 2500,
    priceUnit: "PER_PERSON",
    maxGuests: 15,
    activityLevel: "LIGHT",
    skillLevel: "BEGINNER",
    included: ["Licensed guide"],
    notIncluded: ["Citadel entry ticket", "Transport"],
    accessibility: ["flat-ground"],
    languages: ["ar", "en", "fr"],
    tags: ["historic", "family-friendly"],
    cancellationHours: 24,
    schedule: { days: [6, 0], times: ["10:00"] },
    photos: ["1527631746610-bca00a040d60", "1539635278303-d4002c07eae3"],
  },
  {
    host: "Karm Sunset (demo)",
    kind: "SERVICE",
    slug: "golden-hour-photo-session-demo",
    title: "Golden-hour photo session in the vines (demo)",
    description:
      "An hour with a photographer among the vines at sunset. Thirty edited photos within three days.\n\nDemo listing for testing.",
    category: "photography",
    area: "West Bekaa",
    meetingPoint: "Karm Sunset terrace",
    latitude: 33.6436,
    longitude: 35.7311,
    durationMinutes: 60,
    price: 8000,
    priceUnit: "PER_GROUP",
    maxGuests: 6,
    included: ["30 edited photos", "Online gallery"],
    notIncluded: ["Printed photos"],
    accessibility: ["flat-ground", "step-free-access"],
    languages: ["ar", "en"],
    tags: ["romantic", "family-friendly"],
    cancellationHours: 48,
    schedule: { days: [0, 6], times: ["17:30"] },
    photos: ["1452587925148-ce544e77e70d"],
  },
  {
    host: "Faraya Snow Lodge (demo)",
    kind: "SERVICE",
    slug: "faraya-lodge-massage-demo",
    title: "Massage by the fire (demo)",
    description:
      "A relaxing massage in the lodge's quiet room after a day on the slopes.\n\nDemo listing for testing.",
    category: "wellness",
    area: "Faraya",
    meetingPoint: "Faraya Snow Lodge",
    latitude: 34.0047,
    longitude: 35.8239,
    durationMinutes: 60,
    price: 7000,
    priceUnit: "PER_PERSON",
    maxGuests: 2,
    minAge: 18,
    included: ["Oils and towels", "Herbal tea"],
    notIncluded: [],
    accessibility: ["step-free-access", "low-sensory"],
    languages: ["ar", "en"],
    tags: ["romantic", "quiet"],
    cancellationHours: 24,
    schedule: { days: [5, 6, 0], times: ["16:00", "18:00"] },
    photos: ["1544161515-4ab6ce6db874"],
  },
];

const SESSION_DAYS_AHEAD = 28;
const stockPhotoUrl = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=75`;

/** A Beirut wall-clock time on a calendar date, as a UTC instant (handles summer time). */
function beirutInstant(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const guess = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes),
  );
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetHours = Number(offset?.replace("GMT", "") || 0);
  return new Date(guess.getTime() - offsetHours * 3_600_000);
}

async function ensureSessions(offeringId: string, businessId: string, offering: DemoOffering) {
  const now = new Date();
  if ((await prisma.offeringSession.count({ where: { offeringId, startsAt: { gt: now } } })) > 0) return;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sessions = [];
  for (let day = 1; day <= SESSION_DAYS_AHEAD; day += 1) {
    const date = new Date(today.getTime() + day * 86_400_000);
    if (!offering.schedule.days.includes(date.getUTCDay())) continue;
    for (const time of offering.schedule.times) {
      const startsAt = beirutInstant(date, time);
      sessions.push({
        businessId,
        offeringId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + offering.durationMinutes * 60_000),
        capacity: offering.maxGuests,
      });
    }
  }
  await prisma.offeringSession.createMany({ data: sessions });
}

export async function seedOfferings() {
  for (const offering of OFFERINGS) {
    const host = await prisma.business.findFirst({
      where: { name: offering.host },
      select: { id: true, currency: true },
    });
    if (!host) continue;
    const { price, photos, category, ...rest } = offering;
    const fields = Object.fromEntries(
      Object.entries(rest).filter(([key]) => key !== "host" && key !== "schedule"),
    ) as Omit<typeof rest, "host" | "schedule">;
    const saved = await prisma.offering.upsert({
      where: { slug: offering.slug },
      update: {},
      create: { ...fields, businessId: host.id, categorySlug: category, priceCents: price },
    });
    if ((await prisma.photo.count({ where: { offeringId: saved.id } })) === 0) {
      await prisma.photo.createMany({
        data: photos.map((id, position) => ({
          businessId: host.id,
          offeringId: saved.id,
          url: stockPhotoUrl(id),
          alt: `${offering.title}, stock photo`,
          position,
        })),
      });
    }
    await ensureSessions(saved.id, host.id, offering);
  }
  return OFFERINGS.length;
}

export async function seedPlaceDetails() {
  for (const [name, details] of Object.entries(PLACE_DETAILS)) {
    await prisma.business.updateMany({ where: { name }, data: details });
  }
}
