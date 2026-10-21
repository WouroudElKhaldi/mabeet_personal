import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { auth } from "@/server/auth/better-auth";
import type { TenantContext } from "@/server/auth/tenant-context";
import { env } from "@/server/env";
import { AppError, invalid, notFound, unauthenticated } from "@/server/errors";
import { resolveContext } from "@/server/services/team-service";

type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: RouteContext) => Promise<Response>;

/** Wraps a route handler: maps domain errors to HTTP and never leaks internals on unexpected ones. */
export function route(handler: Handler): Handler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid input", details: z.flattenError(error) } },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status });
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body: unknown = await request.json().catch(() => {
    throw invalid("Request body must be JSON");
  });
  return schema.parse(body);
}

export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

export async function parseParams<T extends z.ZodType>(
  context: RouteContext,
  schema: T,
): Promise<z.infer<T>> {
  return schema.parse(await context.params);
}

export async function optionalUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export async function requireUser(request: Request) {
  const user = await optionalUser(request);
  if (!user) throw unauthenticated();
  return user;
}

/** Scheduled jobs call in with `Authorization: Bearer <CRON_SECRET>`. */
export function requireCronSecret(request: Request): void {
  const presented = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) throw unauthenticated();
}

/** Resolves the caller's membership in the workspace named by the URL. Non-members get 404, never 403. */
export async function requireTenant(request: Request, businessId: string): Promise<TenantContext> {
  const user = await requireUser(request);
  const ctx = await resolveContext(user.id, businessId);
  if (!ctx) throw notFound("Workspace");
  return ctx;
}
