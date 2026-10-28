import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, forbidden } from "@/server/errors";

// The queue runs in "queue" mode against a fake pg-boss: what matters here is the choice between answering in
// the request and queueing, and what a client following a job is allowed to see.

const env = vi.hoisted(() => ({
  JOBS_MODE: "queue" as "inline" | "queue",
  JOBS_SYNC_LIMIT_SECONDS: 25,
  DATABASE_URL: "postgres://test",
}));
vi.mock("@/server/env", () => ({ env }));
vi.spyOn(console, "warn").mockImplementation(() => undefined);
const live = vi.hoisted(() => ({ progress: null as null | { step: string | null; text: string } }));
vi.mock("@/server/jobs/progress", () => ({
  readProgress: vi.fn(async () => live.progress),
  progressWriter: () => ({ report: () => undefined, close: async () => undefined }),
}));

const boss = vi.hoisted(() => ({
  ready: 0,
  sent: [] as Array<{ queue: string; data: object }>,
  stored: null as null | { data: object; state: string; output: unknown },
}));
vi.mock("pg-boss", () => ({
  PgBoss: class {
    on() {}
    async start() {}
    async getQueues() {
      return [{ name: "ai" }, { name: "notify" }, { name: "cron" }];
    }
    async getQueue() {
      return { readyCount: boss.ready };
    }
    async send(queue: string, data: object) {
      boss.sent.push({ queue, data });
      return `job-${boss.sent.length}`;
    }
    async findJobs() {
      return boss.stored ? [boss.stored] : [];
    }
  },
}));

const { defineJob, findJob, runOrQueue, runPayload } = await import("@/server/jobs/queue");
const { chatSeconds, reportSeconds } = await import("@/server/jobs/ai-jobs");

const answer = vi.fn(async ({ question }: { question: string }) => `answer to ${question}`);
const job = defineJob("ai", "test.answer", answer);

// The load is cached for two seconds per process, so each test moves the clock past it.
let now = Date.now();
beforeEach(() => {
  now += 10_000;
  vi.spyOn(Date, "now").mockReturnValue(now);
  boss.ready = 0;
  boss.sent.length = 0;
  boss.stored = null;
  answer.mockClear();
  env.JOBS_MODE = "queue";
  env.JOBS_SYNC_LIMIT_SECONDS = 25;
});

describe("runOrQueue", () => {
  it("answers a quick job inside the request when nothing is waiting", async () => {
    await expect(runOrQueue(job, { question: "hi" }, 6)).resolves.toEqual({
      status: "done",
      result: "answer to hi",
    });
    expect(boss.sent).toEqual([]);
  });

  it("queues a job expected to take too long, without running it here", async () => {
    await expect(runOrQueue(job, { question: "a long one" }, 40)).resolves.toEqual({
      status: "queued",
      jobId: "job-1",
    });
    expect(answer).not.toHaveBeenCalled();
    expect(boss.sent).toEqual([
      { queue: "ai", data: { job: "test.answer", data: { question: "a long one" } } },
    ]);
  });

  it("queues even a quick job while others are waiting, so it does not jump the line", async () => {
    boss.ready = 3;
    await expect(runOrQueue(job, { question: "hi" }, 6)).resolves.toMatchObject({ status: "queued" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("queues everything when the limit is 0", async () => {
    env.JOBS_SYNC_LIMIT_SECONDS = 0;
    await expect(runOrQueue(job, { question: "hi" }, 1)).resolves.toMatchObject({ status: "queued" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("runs everything in the request in inline mode, whatever its size", async () => {
    env.JOBS_MODE = "inline";
    await expect(runOrQueue(job, { question: "big" }, 400)).resolves.toMatchObject({ status: "done" });
    expect(boss.sent).toEqual([]);
  });

  it("passes the user's own errors through, for the route to answer with", async () => {
    const refused = defineJob("ai", "test.refused", async () => {
      throw forbidden();
    });
    await expect(runOrQueue(refused, {}, 1)).rejects.toBeInstanceOf(AppError);
  });
});

describe("runPayload (the worker)", () => {
  it("stores a user's error as a safe outcome instead of retrying it", async () => {
    defineJob("ai", "test.over-budget", async () => {
      throw new AppError("UNAVAILABLE", "The assistant is resting until next month.");
    });
    await expect(runPayload({ job: "test.over-budget", data: {} }, "job-id")).resolves.toEqual({
      ok: false,
      error: { code: "UNAVAILABLE", status: 503, message: "The assistant is resting until next month." },
    });
  });

  it("throws anything else, so pg-boss retries the job", async () => {
    defineJob("ai", "test.crash", async () => {
      throw new Error("socket hang up");
    });
    await expect(runPayload({ job: "test.crash", data: {} }, "job-id")).rejects.toThrow("socket hang up");
  });

  it("keeps the job's kind apart from data that has a kind of its own", async () => {
    const notice = defineJob("notify", "test.notice", async ({ kind }: { kind: string }) => kind);
    await notice.enqueue({ kind: "stay" });
    expect(boss.sent.at(-1)?.data).toEqual({ job: "test.notice", data: { kind: "stay" } });
    await expect(runPayload({ job: "test.notice", data: { kind: "stay" } }, "job-id")).resolves.toEqual({
      ok: true,
      result: "stay",
    });
  });

  it("refuses a kind nobody declared", async () => {
    await expect(runPayload({ job: "test.unknown", data: {} }, "job-id")).rejects.toThrow(/No handler/);
  });
});

describe("findJob", () => {
  it("returns the result of a finished job", async () => {
    boss.stored = {
      data: { job: "ai.team", data: { userId: "u1" } },
      state: "completed",
      output: { ok: true, result: { reply: "hi" } },
    };
    await expect(findJob("ai", "id")).resolves.toEqual({
      data: { userId: "u1" },
      state: { status: "done", result: { reply: "hi" } },
    });
  });

  it("never shows the stored error of a job that crashed, only a generic message", async () => {
    boss.stored = { data: {}, state: "failed", output: { message: "connect ECONNREFUSED 10.0.0.5:5432" } };
    const found = await findJob("ai", "id");
    expect(found?.state).toMatchObject({ status: "failed", error: { status: 503 } });
    expect(JSON.stringify(found)).not.toContain("ECONNREFUSED");
  });

  it("reports waiting jobs, and running ones with what they have written so far", async () => {
    boss.stored = { data: {}, state: "retry", output: null };
    await expect(findJob("ai", "id")).resolves.toMatchObject({ state: { status: "queued" } });
    boss.stored = { data: {}, state: "active", output: null };
    live.progress = { step: null, text: "Two lodges in Faraya are" };
    await expect(findJob("ai", "id")).resolves.toMatchObject({
      state: { status: "running", progress: { step: null, text: "Two lodges in Faraya are" } },
    });
  });
});

describe("estimates", () => {
  const ask = (characters: number) => [{ role: "user" as const, content: "x".repeat(characters) }];

  it("grows with the input, and puts every AI answer over the 5-second default", () => {
    const longChat = Array.from({ length: 20 }, () => ask(2_000)[0]!);
    expect(chatSeconds("concierge", longChat)).toBeGreaterThan(chatSeconds("concierge", ask(200)));
    expect(chatSeconds("team", ask(200))).toBeGreaterThan(chatSeconds("concierge", ask(200)));
    expect(chatSeconds("concierge", ask(1))).toBeGreaterThan(5);
  });

  it("estimates a report above any chat question: it writes a long answer whatever the period", () => {
    expect(reportSeconds(1, 1)).toBeGreaterThan(chatSeconds("team", ask(2_000)));
    expect(reportSeconds(731, 5)).toBeGreaterThan(reportSeconds(30, 1));
  });
});
