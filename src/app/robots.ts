import type { MetadataRoute } from "next";
import { env } from "@/server/env";

/** Areas that hold personal data or need a sign-in. Booking links (/b/…) are private keys, never indexed. */
const PRIVATE = ["/api/", "/dashboard", "/admin", "/account", "/b/", "/oauth/", "/reset-password"];

/** AI crawlers are welcome on the public pages, so assistants can answer questions about Mabeet correctly. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: new URL("/sitemap.xml", env.BETTER_AUTH_URL).toString(),
    host: env.BETTER_AUTH_URL,
  };
}
