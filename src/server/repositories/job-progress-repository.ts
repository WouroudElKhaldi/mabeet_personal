import type { Db } from "@/server/db/client";

export interface JobProgressRow {
  step: string | null;
  text: string;
}

export async function saveProgress(db: Db, jobId: string, progress: JobProgressRow): Promise<void> {
  await db.jobProgress.upsert({ where: { jobId }, create: { jobId, ...progress }, update: progress });
}

export function findProgress(db: Db, jobId: string): Promise<JobProgressRow | null> {
  return db.jobProgress.findUnique({ where: { jobId }, select: { step: true, text: true } });
}

export async function deleteProgress(db: Db, jobId: string): Promise<void> {
  await db.jobProgress.deleteMany({ where: { jobId } });
}

/** Removes what crashed workers left behind. Called by housekeeping. */
export async function deleteStaleProgress(db: Db, before: Date): Promise<number> {
  const { count } = await db.jobProgress.deleteMany({ where: { updatedAt: { lt: before } } });
  return count;
}
