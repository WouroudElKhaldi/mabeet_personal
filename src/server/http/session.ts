import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/server/auth/better-auth";
import type { Permission } from "@/server/auth/permissions";
import type { TenantContext } from "@/server/auth/tenant-context";
import { resolveContext } from "@/server/services/team-service";

/** The signed-in user for server components, resolved once per request. */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requirePageUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** The acting member for a dashboard page. Non-members get the 404 page, like the API. */
export const requirePageTenant = cache(async (businessId: string): Promise<TenantContext> => {
  const user = await requirePageUser(`/dashboard/${businessId}`);
  const ctx = await resolveContext(user.id, businessId);
  if (!ctx) notFound();
  return ctx;
});

/**
 * A dashboard page that needs one of `anyOf`. A member without it gets the 404 page, exactly like
 * a non-member, instead of a crash into the error page when a service refuses.
 */
export async function requirePageAccess(businessId: string, anyOf: readonly Permission[]) {
  const ctx = await requirePageTenant(businessId);
  if (!anyOf.some((permission) => ctx.permissions.has(permission))) notFound();
  return ctx;
}
