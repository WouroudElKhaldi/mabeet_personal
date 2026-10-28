import type { z } from "zod";
import { toDateRange } from "@/lib/dates";
import type { AnalyticsScope, ReportTopic } from "@/config/enums";
import { forbidden } from "@/server/errors";
import { askConcierge, askTeamAssistant } from "@/server/services/assistant-service";
import { answerChat } from "@/server/services/chat-service";
import { generateReport } from "@/server/services/report-service";
import { resolveContext } from "@/server/services/team-service";
import type { chatInput } from "@/server/validation/schemas";
import { type ProgressWriter, progressWriter } from "./progress";
import { defineJob } from "./queue";

// The AI work, as jobs on the "ai" queue. A route runs one inside the request when it is small and the server is
// quiet, or queues it (see runOrQueue). Jobs carry who asked, never a ready-made permission set: the worker looks
// the member up again, so someone removed from a team while their question waited gets no answer.

type ChatRequest = z.infer<typeof chatInput>;

/** The member's current permissions in this business, or a refusal when they no longer belong to it. */
async function memberContext(userId: string, businessId: string) {
  const ctx = await resolveContext(userId, businessId);
  if (!ctx) throw forbidden();
  return ctx;
}

/** Runs a job's work with a live-progress writer for it, removed once the work is done or has failed. */
async function withProgress<T>(jobId: string | null, work: (progress: ProgressWriter) => Promise<T>) {
  const progress = progressWriter(jobId);
  try {
    return await work(progress);
  } finally {
    await progress.close();
  }
}

export const conciergeJob = defineJob(
  "ai",
  "ai.concierge",
  ({ userId, chat }: { userId: string | null; chat: ChatRequest }, jobId) =>
    withProgress(jobId, (progress) => {
      const scope = userId ? { userId, surface: "concierge" as const, businessId: null } : null;
      const ask = (history: ChatRequest["messages"]) => askConcierge(history, progress.report);
      return answerChat(scope, chat, ask, (answer) => ({ places: answer.places }));
    }),
);

export const teamAssistantJob = defineJob(
  "ai",
  "ai.team",
  ({ userId, businessId, chat }: { userId: string; businessId: string; chat: ChatRequest }, jobId) =>
    withProgress(jobId, async (progress) => {
      const ctx = await memberContext(userId, businessId);
      const scope = { userId, surface: "team" as const, businessId };
      return answerChat(scope, chat, (history) => askTeamAssistant(ctx, history, progress.report));
    }),
);

interface ReportRequest {
  userId: string;
  businessId: string;
  scope: AnalyticsScope;
  from: string;
  to: string;
  topics: ReportTopic[];
  locale: string;
}

export const reportJob = defineJob(
  "ai",
  "ai.report",
  ({ userId, businessId, from, to, ...input }: ReportRequest, jobId) =>
    withProgress(jobId, async (progress) => {
      const ctx = await memberContext(userId, businessId);
      // A report is one JSON answer, nothing to show word by word: only what the worker is doing.
      progress.report({ step: "write_report", text: "" });
      return generateReport(ctx, { ...input, range: toDateRange({ checkIn: from, checkOut: to }) });
    }),
);

// ---------- How long the work is expected to take ----------
// Rough seconds from what we know before calling the model: a fixed cost for its rounds, plus the time to read the
// input (sent again on every round). Compared with JOBS_SYNC_LIMIT_SECONDS in runOrQueue.

const CHARS_PER_SECOND = 1_500;

/**
 * A concierge answer is usually two model calls (search, then reply): 15-20 s measured on DeepSeek. A team
 * answer often needs a round more.
 */
export function chatSeconds(surface: "concierge" | "team", messages: ChatRequest["messages"]): number {
  const base = surface === "concierge" ? 15 : 20;
  const characters = messages.reduce((sum, message) => sum + message.content.length, 0);
  return base + characters / CHARS_PER_SECOND;
}

/**
 * A report writes up to 2,000 tokens whatever the period, so it takes 30 seconds or more. Longer periods and more
 * topics add to the input and to the sections written.
 */
export function reportSeconds(days: number, topics: number): number {
  return 25 + topics * 4 + days / 90;
}
