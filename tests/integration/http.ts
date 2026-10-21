import { randomUUID } from "node:crypto";
import { auth } from "@/server/auth/better-auth";

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export interface Caller {
  userId: string;
  cookie: string;
}

/** Signs up a real user through Better Auth and returns their session cookie. */
export async function signUp(name: string): Promise<Caller> {
  const response = await auth.api.signUpEmail({
    body: { name, email: `${randomUUID()}@example.test`, password: "correct-horse-battery" },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const { user } = (await response.json()) as { user: { id: string } };
  return { userId: user.id, cookie };
}

export interface CallOptions {
  as?: Caller;
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

/** Invokes a Next.js route handler the way the framework would. */
export async function call(handler: RouteHandler, { as, params = {}, body, query }: CallOptions = {}) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const request = new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(as && { cookie: as.cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params) });
  return { status: response.status, body: (await response.json()) as unknown };
}
