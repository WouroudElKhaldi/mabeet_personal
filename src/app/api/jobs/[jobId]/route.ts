import { z } from "zod";
import { notFound } from "@/server/errors";
import { localizeError, requestLocale } from "@/server/http/error-i18n";
import { json, optionalUser, parseParams, route } from "@/server/http/route";
import { findJob } from "@/server/jobs/queue";

const params = z.object({ jobId: z.uuid() });

/**
 * Where a queued AI answer or report is: queued, running, done (with the result) or failed (with a message safe
 * to show). Only the person who asked can read it; a visitor's job is reachable only through its random id.
 * Someone else's job is "not found", never "forbidden", so ids cannot be probed.
 */
export const GET = route(async (request, context) => {
  const { jobId } = await parseParams(context, params);
  const job = await findJob("ai", jobId);
  const owner = (job?.data as { userId?: string | null } | undefined)?.userId ?? null;
  if (!job || (owner !== null && owner !== (await optionalUser(request))?.id)) throw notFound("Job");
  const { state } = job;
  if (state.status !== "failed") return json(state);
  return json({
    ...state,
    error: { ...state.error, message: localizeError(state.error.message, requestLocale(request)) },
  });
});
