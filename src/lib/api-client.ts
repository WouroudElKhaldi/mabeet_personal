/** Error carrying the API's own message, safe to show to the user, and the input fields it rejected. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly invalidFields: readonly string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The API's message for a failed call, or the given fallback for anything else (network down, a bug). */
export const errorMessage = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? caught.message : fallback;

interface ErrorBody {
  error?: { message?: string; details?: { fieldErrors?: Record<string, unknown> } };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    // A FormData body sets its own multipart content type.
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  if (!response.ok) {
    const invalidFields = Object.keys(body.error?.details?.fieldErrors ?? {});
    throw new ApiError(response.status, body.error?.message ?? "Something went wrong", invalidFields);
  }
  return body as T;
}

/** What a running job has shown so far: the tool it is using (`step`), then its reply as it is written. */
export interface JobProgress {
  step: string | null;
  text: string;
}

type JobState<T> =
  | { status: "queued" }
  | { status: "running"; progress: JobProgress | null }
  | { status: "done"; result: T }
  | { status: "failed"; error: { status: number; message: string } };

const isQueued = (body: unknown): body is { status: "queued"; jobId: string } =>
  typeof body === "object" && body !== null && (body as { status?: unknown }).status === "queued";

/** Every half second while the answer is being written, so it reads as it arrives; every second while waiting. */
const pollDelay = (status: JobState<unknown>["status"]) => (status === "running" ? 500 : 1_000);
/** A queued job that has not finished after this long is reported as failed (the server gives up sooner). */
const MAX_WAIT_MS = 6 * 60_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs work that the server may answer at once (200) or queue (202 + jobId). Either way it resolves with the
 * result, following a queued job at /api/jobs/{jobId} until it is done. `onProgress` hears what a running job has
 * written so far.
 */
async function run<T>(url: string, body: unknown, onProgress?: (progress: JobProgress) => void): Promise<T> {
  const first = await request<T | { status: "queued"; jobId: string }>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!isQueued(first)) return first;
  const deadline = Date.now() + MAX_WAIT_MS;
  let status: JobState<T>["status"] = "queued";
  while (Date.now() < deadline) {
    await wait(pollDelay(status));
    const state = await request<JobState<T>>(`/api/jobs/${first.jobId}`);
    status = state.status;
    if (state.status === "done") return state.result;
    if (state.status === "failed") throw new ApiError(state.error.status, state.error.message);
    if (state.status === "running" && state.progress) onProgress?.(state.progress);
  }
  throw new ApiError(504, "This is taking longer than expected. Please try again.");
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>(url, { signal }),
  post: <T>(url: string, body: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  run,
  patch: <T>(url: string, body: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  upload: <T>(url: string, form: FormData) => request<T>(url, { method: "POST", body: form }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "DELETE", ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
};
