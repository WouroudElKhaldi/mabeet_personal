import { describe, expect, it } from "vitest";
import { findUngrantable, readOnly, toPermissions } from "@/server/auth/permissions";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { AppError } from "@/server/errors";

const context = (permissions: string[]): TenantContext => ({
  userId: "u1",
  businessId: "b1",
  membershipId: "m1",
  isOwner: false,
  permissions: toPermissions(permissions),
  channel: "web",
});

describe("permissions", () => {
  it("ignores unknown permission keys stored on a role", () => {
    expect([...toPermissions(["bookings.read", "launch.missiles"])]).toEqual(["bookings.read"]);
  });

  it("refuses to let anyone grant a permission they lack", () => {
    const grantor = toPermissions(["bookings.read", "roles.manage"]);
    expect(findUngrantable(grantor, ["bookings.read"])).toEqual([]);
    expect(findUngrantable(grantor, ["bookings.read", "settings.manage"])).toEqual(["settings.manage"]);
  });

  it("strips every write permission for read-only keys", () => {
    const narrowed = readOnly(
      toPermissions(["bookings.read", "bookings.decide", "analytics.read", "rooms.manage"]),
    );
    expect([...narrowed].sort()).toEqual(["analytics.read", "bookings.read"]);
  });

  it("throws FORBIDDEN when a member lacks the permission", () => {
    const ctx = context(["bookings.read"]);
    expect(can(ctx, "bookings.read")).toBe(true);
    expect(() => requirePermission(ctx, "bookings.decide")).toThrow(AppError);
    expect(() => requirePermission(ctx, "bookings.decide")).toThrow(/bookings.decide/);
  });
});
