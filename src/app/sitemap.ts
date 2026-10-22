import type { MetadataRoute } from "next";
import { env } from "@/server/env";
import { searchOfferings, searchPlaces } from "@/server/services/directory-service";

// Built on request from the live listings, so a new place appears as soon as it is listed.
export const dynamic = "force-dynamic";

const LISTING_LIMIT = 500;
const PAGES = ["/", "/search", "/assistant", "/pricing", "/host", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();
  const [places, offerings] = await Promise.all([
    searchPlaces({ guests: 1, limit: LISTING_LIMIT }),
    searchOfferings({ limit: LISTING_LIMIT }),
  ]);
  return [
    ...PAGES.map((path) => ({
      url: url(path),
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.6,
    })),
    ...places.map((place) => ({
      url: url(`/p/${place.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...offerings.map((offering) => ({
      url: url(`/o/${offering.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
