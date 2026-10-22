import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { deleteExpiredWindows, hitWindow } from "@/server/repositories/rate-limit-repository";

// Fixed-window limits kept in Postgres, so every server instance (serverless included) shares one count.

export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const { count, resetAt } = await hitWindow(prisma, key, windowMs);
  if (count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", {
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
    });
  }
}

/** Drops windows that ended more than an hour ago. */
export function cleanUpRateLimits(now = new Date()) {
  return deleteExpiredWindows(prisma, new Date(now.getTime() - 3_600_000));
}

/**
 * The client's address. On Vercel, x-real-ip and the first x-forwarded-for entry are set by the platform
 * and cannot be forged by the caller; behind your own proxy, make sure it overwrites these headers.
 */
export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
