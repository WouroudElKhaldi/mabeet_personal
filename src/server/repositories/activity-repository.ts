import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

export interface ActivityEntry {
  userId?: string | null;
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

export function logActivity(db: Db, entry: ActivityEntry) {
  return db.activityLog.create({ data: entry });
}

export function listUserActivity(db: Db, userId: string, take: number) {
  return db.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { business: { select: { name: true, slug: true } } },
  });
}
