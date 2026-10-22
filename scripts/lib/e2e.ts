/**
 * Shared plumbing for the scripts that drive a running app over HTTP (smoke and edge-case runs):
 * a request helper that carries cookies, sign-in, a PASS/FAIL tally and a few date helpers.
 */
import { PrismaClient } from "@prisma/client";

export const BASE = process.env.SMOKE_URL ?? "http://localhost:3000";
export const PASSWORD = process.env.SEED_PASSWORD ?? "demo-password-123";
export const db = new PrismaClient();

let failures = 0;

export function check(name: string, ok: boolean, extra = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
}

/** Prints the tally and exits with a failing code if any check failed. */
export async function finish(): Promise<never> {
  await db.$disconnect();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

export async function http(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", BASE);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
}

/** Sends JSON and returns the status with the parsed body. */
export async function send(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  cookie?: string,
) {
  const response = await http(path, { method, cookie, body: JSON.stringify(body) });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body: parsed };
}

const SIGN_IN_ATTEMPTS = 4;

/** Signs in, waiting out sign-in rate limiting (a few attempts per 10 seconds per address) when a run hits it. */
export async function signIn(email: string, password = PASSWORD) {
  let response = await attemptSignIn(email, password);
  for (let attempt = 1; response.status === 429 && attempt < SIGN_IN_ATTEMPTS; attempt += 1) {
    const waitSeconds = Number(
      response.headers.get("x-retry-after") ?? response.headers.get("retry-after") ?? 10,
    );
    await new Promise((resolve) => setTimeout(resolve, (waitSeconds + 1) * 1000));
    response = await attemptSignIn(email, password);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  check(`sign in as ${email}`, response.status === 200 && cookie.length > 0, `status ${response.status}`);
  return cookie;
}

function attemptSignIn(email: string, password: string) {
  return http("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
}

export const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * With loading skeletons, Next.js has already sent status 200 when a page discovers it does not exist;
 * it then renders the not-found page and marks it noindex. Either outcome means "not found".
 */
export async function isNotFound(response: Response): Promise<boolean> {
  if (response.status === 404) return true;
  const html = await response.text();
  return html.includes("This page wandered off") && /name="robots" content="noindex/.test(html);
}
