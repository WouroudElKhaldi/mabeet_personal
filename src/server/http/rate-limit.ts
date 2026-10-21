import { AppError } from "@/server/errors";

// Fixed-window limiter kept in memory. Good for one server process (local, a single VM);
// on serverless with many instances, swap the store for Postgres or Redis behind the same function.

const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_KEYS = 10_000;

export function enforceRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", {
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    });
  }
}

/** Best-effort client address behind a proxy. */
export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
