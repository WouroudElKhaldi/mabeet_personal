import type { Db } from "@/server/db/client";

export function recordUsage(
  db: Db,
  usage: {
    surface: string;
    businessId: string | null;
    promptTokens: number;
    completionTokens: number;
    costMicroUsd: number;
  },
) {
  return db.aiUsage.create({ data: usage, select: { id: true } });
}

/** Totals since `since`, per surface. */
export function sumUsageSince(db: Db, since: Date) {
  return db.aiUsage.groupBy({
    by: ["surface"],
    where: { createdAt: { gte: since } },
    _sum: { costMicroUsd: true, promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });
}

export async function sumCostSince(db: Db, since: Date): Promise<number> {
  const { _sum } = await db.aiUsage.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { costMicroUsd: true },
  });
  return _sum.costMicroUsd ?? 0;
}

export async function listSuperAdminEmails(db: Db): Promise<string[]> {
  const admins = await db.user.findMany({ where: { platformRole: "SUPER_ADMIN" }, select: { email: true } });
  return admins.map((admin) => admin.email);
}
