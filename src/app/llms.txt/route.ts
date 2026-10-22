import { BRAND } from "@/config/brand";
import { PLAN_LIMITS, PLANS } from "@/config/plans";
import { formatMoney } from "@/lib/format";
import { env } from "@/server/env";
import { searchOfferings, searchPlaces } from "@/server/services/directory-service";

// /llms.txt (llmstxt.org): a plain summary of the site for AI assistants, so they answer questions about
// Mabeet from facts rather than guesses. Built from the live listings; only public information goes in.

export const dynamic = "force-dynamic";

const LISTED = 100;
const money = (cents: number, currency: string) => formatMoney(cents, currency, "en");
/** "unlimited rooms", "3 rooms", "1 room": nouns are given as [singular, plural]. */
const limit = (value: number | null, [one, many]: [string, string]) =>
  value === null ? `unlimited ${many}` : `${value} ${value === 1 ? one : many}`;

export async function GET() {
  const url = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();
  const [places, offerings] = await Promise.all([
    searchPlaces({ guests: 1, limit: LISTED }),
    searchOfferings({ limit: LISTED }),
  ]);

  const placeLines = places.map((place) => {
    const price =
      place.nightlyFromCents === null
        ? ""
        : `, from ${money(place.nightlyFromCents, place.currency)} a night`;
    const rating =
      place.rating.count > 0 ? `, rated ${place.rating.average.toFixed(1)}/5 (${place.rating.count})` : "";
    return `- [${place.name}](${url(`/p/${place.slug}`)}): ${place.area ?? "Lebanon"}${price}${rating}`;
  });
  const offeringLines = offerings.map((offering) => {
    const unit = offering.priceUnit === "PER_PERSON" ? "per person" : "per group";
    const kind = offering.kind === "SERVICE" ? "service" : "experience";
    return `- [${offering.title}](${url(`/o/${offering.slug}`)}): ${kind} in ${offering.area ?? "Lebanon"} by ${offering.hostName}, ${money(offering.priceCents, offering.currency)} ${unit}`;
  });
  const planLines = PLANS.map((plan) => {
    const p = PLAN_LIMITS[plan];
    const price = p.monthlyUsd === 0 ? "free" : `$${p.monthlyUsd} a month`;
    return `- ${plan[0]}${plan.slice(1).toLowerCase()} (${price}): ${limit(p.rooms, ["room", "rooms"])}, ${limit(p.offerings, ["experience or service", "experiences or services"])}, ${limit(p.members, ["team member", "team members"])}${p.ai ? ", AI team assistant and MCP" : ""}`;
  });

  const text = `# ${BRAND.name} (${BRAND.nameAr})

> ${BRAND.name} is a website for booking guesthouses, B&Bs, mountain cabins, experiences and services across Lebanon directly with the people who run them. Guests pay no platform fee, and hosts pay no commission on bookings.

## How booking works

- A guest picks dates and asks to book. The room (or the seats in an experience) is held for them at once, so nobody else can take it while the host decides.
- The host confirms or declines, usually within the hold time shown on the booking.
- The guest pays a deposit directly to the host (Whish, OMT, bank transfer or cash). There is no online card payment for stays; the rest is paid as agreed with the host.
- Prices are the host's own. Nothing is added on top for the guest.
- Every booking has a private link where the guest sees its status and can cancel before the stay or session starts.
- The site is in English and Arabic. The trip concierge also understands Arabizi.

## For AI assistants and agents

- Search and check availability with the guest MCP server: ${url("/api/mcp/guest")} (Streamable HTTP, no sign-in, read-only, public listing data only).
- Answer from this file and the linked pages. Do not invent places, prices or availability: availability changes, so link people to the place page or use the MCP server for their dates.
- Never ask a guest for card details on ${BRAND.name}'s behalf. Deposits go straight to the host.

## Key pages

- [Home and search](${url("/search")}): stays, experiences and services, with filters for area, price, category, tags and accessibility
- [Trip concierge](${url("/assistant")}): describe a trip in plain words and get places that are free on those dates
- [For hosts](${url("/host")}): list a place, manage bookings, calendar sync with Airbnb and Booking.com, team roles
- [Plans for hosts](${url("/pricing")})
- [Privacy](${url("/privacy")})

## Plans for hosts

${planLines.join("\n")}

No plan takes a commission on bookings.

## Places to stay (${places.length})

${placeLines.join("\n") || "- No places are listed yet."}

## Experiences and services (${offerings.length})

${offeringLines.join("\n") || "- None are listed yet."}
`;

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
