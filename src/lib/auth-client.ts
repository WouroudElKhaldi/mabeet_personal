import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Only same-site paths are allowed after sign-in, so a crafted link cannot bounce users elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
