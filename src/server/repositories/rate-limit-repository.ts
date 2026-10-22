import type { Db } from "@/server/db/client";

/**
 * Counts one hit against a fixed window in a single atomic statement, so concurrent requests on different
 * server instances still share one count. Returns the count so far and when the window resets.
 */
export async function hitWindow(db: Db, key: string, windowMs: number) {
  const [row] = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitWindow" (key, count, "resetAt")
    VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimitWindow"."resetAt" <= now() THEN 1 ELSE "RateLimitWindow".count + 1 END,
      "resetAt" = CASE
        WHEN "RateLimitWindow"."resetAt" <= now() THEN now() + ${windowMs} * interval '1 millisecond'
        ELSE "RateLimitWindow"."resetAt"
      END
    RETURNING count, "resetAt"`;
  return row!;
}

/** Removes windows that ended before `before`. Called by the scheduled cleanup. */
export async function deleteExpiredWindows(db: Db, before: Date): Promise<number> {
  const { count } = await db.rateLimitWindow.deleteMany({ where: { resetAt: { lt: before } } });
  return count;
}
