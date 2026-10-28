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

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>(url, { signal }),
  post: <T>(url: string, body: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  upload: <T>(url: string, form: FormData) => request<T>(url, { method: "POST", body: form }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "DELETE", ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
};
