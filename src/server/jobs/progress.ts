import { prisma } from "@/server/db/client";
import * as progressRepo from "@/server/repositories/job-progress-repository";
import type { JobProgressRow } from "@/server/repositories/job-progress-repository";

// Live progress of a queued AI job: the tool the model is using, then the reply as it is written. Saved at most
// a few times a second; the browser reads it through GET /api/jobs/{jobId} while the job runs.

export type JobProgress = JobProgressRow;

/** How often, at most, progress is written to the database. */
const SAVE_EVERY_MS = 300;

export interface ProgressWriter {
  report(progress: JobProgress): void;
  /** Waits for the last write, then removes the row: the finished answer is the job's own output. */
  close(): Promise<void>;
}

const NOWHERE: ProgressWriter = { report: () => undefined, close: async () => undefined };

/**
 * A writer for one job. Without a job id (the answer is being written inside the request) progress goes nowhere.
 * Writes run one after another, the latest progress wins, and a failed write is logged, never thrown at the job.
 */
export function progressWriter(jobId: string | null): ProgressWriter {
  if (!jobId) return NOWHERE;
  let latest: JobProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const save = () => {
    timer = null;
    const progress = latest;
    latest = null;
    if (!progress) return;
    writing = writing
      .then(() => progressRepo.saveProgress(prisma, jobId, progress))
      .catch((error: unknown) => console.error("[jobs] progress not saved", error));
  };

  return {
    report(progress) {
      latest = progress;
      timer ??= setTimeout(save, SAVE_EVERY_MS);
    },
    async close() {
      if (timer) clearTimeout(timer);
      timer = null;
      latest = null;
      await writing;
      await progressRepo.deleteProgress(prisma, jobId).catch(() => undefined);
    },
  };
}

export function readProgress(jobId: string): Promise<JobProgress | null> {
  return progressRepo.findProgress(prisma, jobId);
}

const STALE_AFTER_MS = 60 * 60_000;

/** Housekeeping: rows a crashed worker never removed. */
export function deleteStaleProgress(now = new Date()): Promise<number> {
  return progressRepo.deleteStaleProgress(prisma, new Date(now.getTime() - STALE_AFTER_MS));
}
