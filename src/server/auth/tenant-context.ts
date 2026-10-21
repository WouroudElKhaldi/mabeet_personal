import { forbidden } from "@/server/errors";
import type { Permission } from "./permissions";

export type Channel = "web" | "mcp" | "chat";

/** Who is acting, in which business, with which permissions. Built once per request and passed down. */
export interface TenantContext {
  readonly userId: string;
  readonly businessId: string;
  readonly membershipId: string;
  readonly isOwner: boolean;
  readonly permissions: ReadonlySet<Permission>;
  readonly channel: Channel;
}

export function can(ctx: TenantContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function requirePermission(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx, permission)) throw forbidden(`Missing permission: ${permission}`);
}
