import { PgBoss } from "pg-boss";
import { inBackground } from "@/server/background";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { type JobProgress, readProgress } from "./progress";

// Background jobs on the app's own Postgres (pg-boss keeps them in its "pgboss" schema). The website only puts
// jobs on a queue; the worker process (`pnpm worker`, src/server/jobs/worker.ts) runs them. With JOBS_MODE
// "inline" (local development and tests) there is no worker: jobs run in this process after the response, as
// before.

/** The queues, each with its own retry policy and its own number of jobs the worker runs at once. */
export const QUEUES = {
  // Assistant answers and AI reports. Few at once, so a burst cannot flood DeepSeek or the monthly budget.
  ai: {
    concurrency: 4,
    options: { retryLimit: 1, retryDelay: 5, expireInSeconds: 300, deleteAfterSeconds: 3_600 },
  },
  // Booking emails and push notifications. Retried with backoff; emails carry idempotency keys.
  notify: {
    concurrency: 8,
    options: {
      retryLimit: 4,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 120,
      deleteAfterSeconds: 86_400,
    },
  },
  // Scheduled housekeeping (calendar sync, expiring holds). One at a time.
  cron: { concurrency: 1, options: { retryLimit: 0, expireInSeconds: 600, deleteAfterSeconds: 86_400 } },
} as const;

export type QueueName = keyof typeof QUEUES;

/**
 * What a job leaves behind: its result, or an error safe to show (an AppError's own message). Errors the user
 * caused (no permission, over budget) end the job at once; anything else is thrown so pg-boss retries it.
 */
export type JobOutcome<Result> =
  { ok: true; result: Result } | { ok: false; error: { code: string; status: number; message: string } };

/**
 * What is stored for a job: its kind, so one queue can hold several kinds of work, and its data kept apart from it
 * (a booking notice has a `kind` of its own, "stay" or "session").
 */
export type Payload = { job: string; data: object };

interface JobDefinition<Data, Result> {
  readonly queue: QueueName;
  readonly kind: string;
  /** Runs the job here and now, as the worker does. */
  run(data: Data): Promise<JobOutcome<Result>>;
  /** Puts the job on its queue and returns its id; inline mode runs it after the response and returns null. */
  enqueue(data: Data): Promise<string | null>;
}

/** A job's code. `jobId` is pg-boss's id in the worker, null when the job runs inside a request or inline. */
type Handler<Data, Result> = (data: Data, jobId: string | null) => Promise<Result>;

const handlers = new Map<string, Handler<unknown, unknown>>();

/** Declares a kind of job. Modules that declare jobs are listed in ./registry.ts, so the worker knows them all. */
export function defineJob<Data extends object, Result = void>(
  queue: QueueName,
  kind: string,
  handler: Handler<Data, Result>,
): JobDefinition<Data, Result> {
  // A later definition replaces an earlier one, as when Next reloads a changed module in development.
  handlers.set(kind, handler as Handler<unknown, unknown>);
  const run = (data: Data) => settle(handler(data, null));
  return {
    queue,
    kind,
    run,
    async enqueue(data) {
      if (env.JOBS_MODE === "inline") {
        inBackground(kind, () => handler(data, null));
        return null;
      }
      return (await queueClient()).send(queue, { job: kind, data } satisfies Payload);
    },
  };
}

async function settle<Result>(work: Promise<Result>): Promise<JobOutcome<Result>> {
  try {
    return { ok: true, result: await work };
  } catch (error) {
    if (error instanceof AppError)
      return { ok: false, error: { code: error.code, status: error.status, message: error.message } };
    throw error;
  }
}

/** The worker's entry for every job on a queue: finds its handler by kind. */
export async function runPayload(payload: Payload, jobId: string): Promise<JobOutcome<unknown>> {
  const handler = handlers.get(payload.job);
  if (!handler) throw new Error(`No handler for job "${payload.job}"`);
  return settle(handler(payload.data, jobId));
}

// ---------- The connection ----------

const globalForBoss = globalThis as unknown as { boss?: Promise<PgBoss> };

/**
 * The website's connection: it sends jobs and reads their state but never runs or schedules them, so it starts
 * without pg-boss's maintenance and cron loops. One per process.
 */
function queueClient(): Promise<PgBoss> {
  globalForBoss.boss ??= startBoss({ supervise: false, schedule: false }).catch((error: unknown) => {
    globalForBoss.boss = undefined;
    throw error;
  });
  return globalForBoss.boss;
}

/** Connects, installs or migrates the pgboss schema when needed, and makes sure every queue exists. */
export async function startBoss(options: { supervise: boolean; schedule: boolean }): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    application_name: "mabeet-jobs",
    max: 4,
    ...options,
  });
  boss.on("error", (error) => console.error("[jobs]", error));
  await boss.start();
  const existing = new Set((await boss.getQueues()).map((queue) => queue.name));
  for (const [name, { options: queueOptions }] of Object.entries(QUEUES)) {
    if (!existing.has(name)) await boss.createQueue(name, queueOptions);
  }
  return boss;
}

// ---------- Following a job ----------

export type JobState =
  | { status: "queued" }
  /** `progress` is what the job has shown so far (the tool in use, the reply being written), when it reports any. */
  | { status: "running"; progress: JobProgress | null }
  | { status: "done"; result: unknown }
  | { status: "failed"; error: { code: string; status: number; message: string } };

/** A job's progress for the client polling it, with its payload so the caller can check who owns it. */
export async function findJob(
  queue: QueueName,
  id: string,
): Promise<{ data: unknown; state: JobState } | null> {
  if (env.JOBS_MODE === "inline") return null;
  const [job] = await (await queueClient()).findJobs<Payload>(queue, { id });
  if (!job) return null;
  const state = toState(job.state, job.output);
  if (state.status === "running") state.progress = await readProgress(id);
  return { data: job.data.data, state };
}

const GENERIC_FAILURE = {
  code: "UNAVAILABLE",
  status: 503,
  message: "The assistant is busy right now. Please try again in a moment.",
};

function toState(state: string, output: unknown): JobState {
  if (state === "created" || state === "retry") return { status: "queued" };
  if (state === "active") return { status: "running", progress: null };
  if (state === "completed") {
    const outcome = output as JobOutcome<unknown>;
    return outcome.ok
      ? { status: "done", result: outcome.result }
      : { status: "failed", error: outcome.error };
  }
  // Failed after its retries, or cancelled: the stored error may hold internals, so it is never shown.
  return { status: "failed", error: GENERIC_FAILURE };
}

// ---------- Run now, or queue ----------

/** Work this process is running inside requests right now; past this many, new work queues. */
const MAX_SYNC_IN_FLIGHT = 4;
const LOAD_CACHE_MS = 2_000;

let syncInFlight = 0;
const loadCache = new Map<QueueName, { waiting: number; at: number }>();

/** Jobs waiting for a worker on this queue, read at most every two seconds so busy routes don't hammer it. */
async function waitingJobs(queue: QueueName): Promise<number> {
  const cached = loadCache.get(queue);
  if (cached && Date.now() - cached.at < LOAD_CACHE_MS) return cached.waiting;
  const stats = await (await queueClient()).getQueue(queue);
  const waiting = stats?.readyCount ?? 0;
  loadCache.set(queue, { waiting, at: Date.now() });
  return waiting;
}

export type Dispatched<Result> = { status: "done"; result: Result } | { status: "queued"; jobId: string };

/**
 * Runs a job inside the request when it is expected to be quick and the server is quiet; otherwise queues it
 * and returns its id at once. `estimateSeconds` comes from the size of the input (see ./ai-jobs.ts). Quick
 * work still queues when jobs are already waiting (it would jump the line) or when this process is already
 * running its share of work inside requests.
 */
export async function runOrQueue<Data extends object, Result>(
  job: JobDefinition<Data, Result>,
  data: Data,
  estimateSeconds: number,
): Promise<Dispatched<Result>> {
  if (env.JOBS_MODE === "inline") return runHere(job, data);
  const waiting = await waitingJobs(job.queue);
  const quick =
    estimateSeconds <= env.JOBS_SYNC_LIMIT_SECONDS && syncInFlight < MAX_SYNC_IN_FLIGHT && waiting === 0;
  const why = `est. ${estimateSeconds.toFixed(1)}s, limit ${env.JOBS_SYNC_LIMIT_SECONDS}s, ${waiting} waiting, ${syncInFlight} running here`;
  console.warn(`[jobs] ${job.kind}: ${quick ? "answered now" : "queued"} (${why})`);
  if (quick) return runHere(job, data);
  const jobId = await job.enqueue(data);
  return jobId ? { status: "queued", jobId } : runHere(job, data);
}

async function runHere<Data extends object, Result>(
  job: JobDefinition<Data, Result>,
  data: Data,
): Promise<Dispatched<Result>> {
  syncInFlight += 1;
  try {
    const outcome = await job.run(data);
    if (!outcome.ok) throw new AppError(outcome.error.code as AppError["code"], outcome.error.message);
    return { status: "done", result: outcome.result };
  } finally {
    syncInFlight -= 1;
  }
}
