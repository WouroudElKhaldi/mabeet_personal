import { Prisma, PrismaClient } from "@prisma/client";

// Only the repository layer imports this module (enforced by ESLint).

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Either the root client or an interactive transaction; every repository function accepts one. */
export type Db = PrismaClient | Prisma.TransactionClient;

export function runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  // Requests for the same room queue on its row lock, so allow time to get a connection and the lock.
  return prisma.$transaction(work, { maxWait: 10_000, timeout: 15_000 });
}

const EXCLUSION_VIOLATION = "23P01";

/** True when Postgres rejected a write because of an EXCLUDE constraint (overlapping stays). */
export function isOverlapError(error: unknown): boolean {
  return JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})).includes(EXCLUSION_VIOLATION);
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
