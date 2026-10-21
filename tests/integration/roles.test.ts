import { beforeEach, describe, expect, it } from "vitest";
import {
  addMember,
  changeMemberRole,
  createRole,
  deleteRole,
  removeMember,
  resolveKeyContext,
  updateRole,
} from "@/server/services/team-service";
import { createPlace, createUser, memberWith, prisma, resetDatabase } from "./helpers";

describe("dynamic roles and permissions", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace();
  });

  it("lets an owner create a custom role with any permissions", async () => {
    const role = await createRole(place.ctx, {
      name: "Night shift",
      permissions: ["bookings.read", "bookings.decide"],
    });
    expect(role.permissions).toEqual(["bookings.read", "bookings.decide"]);
  });

  it("stops a manager from granting a permission they do not hold", async () => {
    const manager = await memberWith(place.business.id, ["roles.manage", "bookings.read"]);
    await expect(
      createRole(manager, { name: "Sneaky", permissions: ["bookings.read", "settings.manage"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createRole(manager, { name: "Viewer", permissions: ["bookings.read"] }),
    ).resolves.toBeDefined();
  });

  it("stops a manager from editing a role that holds more than they do", async () => {
    const manager = await memberWith(place.business.id, ["roles.manage", "bookings.read"]);
    const powerful = await createRole(place.ctx, { name: "Finance", permissions: ["analytics.read"] });
    await expect(updateRole(manager, powerful.id, { name: "Renamed" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("protects the owner role from changes and deletion", async () => {
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    await expect(updateRole(place.ctx, ownerRole.id, { name: "Boss" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteRole(place.ctx, ownerRole.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to delete a role that still has members", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const membership = await prisma.membership.findUniqueOrThrow({ where: { id: staff.membershipId } });
    await expect(deleteRole(place.ctx, membership.roleId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only lets an owner make someone an owner", async () => {
    const manager = await memberWith(place.business.id, ["team.manage", "roles.manage"]);
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    const newcomer = await createUser("Newcomer");
    await expect(addMember(manager, { email: newcomer.email, roleId: ownerRole.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      addMember(place.ctx, { email: newcomer.email, roleId: ownerRole.id }),
    ).resolves.toBeDefined();
  });

  it("stops anyone changing their own access", async () => {
    await expect(removeMember(place.ctx, place.ctx.membershipId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stops a manager from removing or demoting an owner", async () => {
    const manager = await memberWith(place.business.id, ["team.manage", "bookings.read"]);
    const viewerRole = await createRole(place.ctx, { name: "Viewer", permissions: ["bookings.read"] });
    await expect(removeMember(manager, place.ctx.membershipId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeMemberRole(manager, place.ctx.membershipId, viewerRole.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("takes access away as soon as a member is removed", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    await removeMember(place.ctx, staff.membershipId);
    expect(await resolveKeyContext(place.business.id, staff.membershipId, true)).toBeNull();
  });

  it("gives a read-only key only the read part of its member's permissions", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read", "bookings.decide", "analytics.read"]);
    const keyContext = await resolveKeyContext(place.business.id, staff.membershipId, false);
    expect([...(keyContext?.permissions ?? [])].sort()).toEqual(["analytics.read", "bookings.read"]);
  });
});
