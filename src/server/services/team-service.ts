import type { Membership, Role } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  findUngrantable,
  type Permission,
  readOnly,
  toPermissions,
} from "@/server/auth/permissions";
import { type Channel, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isUniqueViolation, prisma } from "@/server/db/client";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import * as team from "@/server/repositories/team-repository";
import { recordAction } from "./audit";

type MembershipWithRole = Membership & { role: Role };

function contextFrom(membership: MembershipWithRole, channel: Channel, writeAccess = true): TenantContext {
  const granted = membership.role.isOwner
    ? new Set(ALL_PERMISSIONS)
    : toPermissions(membership.role.permissions);
  return {
    userId: membership.userId,
    businessId: membership.businessId,
    membershipId: membership.id,
    isOwner: membership.role.isOwner,
    permissions: writeAccess ? granted : readOnly(granted),
    channel,
  };
}

/** Resolves the acting member for a signed-in user. Returns null when they are not an active member. */
export async function resolveContext(userId: string, businessId: string, channel: Channel = "web") {
  const membership = await team.findActiveMembership(prisma, userId, businessId);
  return membership && contextFrom(membership, channel);
}

/** Resolves the member behind an API key. Read-only keys keep only the read part of the member's permissions. */
export async function resolveKeyContext(businessId: string, membershipId: string, canWrite: boolean) {
  const membership = await team.findMembershipById(prisma, businessId, membershipId);
  return membership && contextFrom(membership, "mcp", canWrite);
}

export function listWorkspaces(userId: string) {
  return team.listUserWorkspaces(prisma, userId);
}

// ---------- Roles ----------

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: Permission[];
}

function assertCanGrant(ctx: TenantContext, permissions: readonly Permission[]): void {
  const missing = findUngrantable(ctx.permissions, permissions);
  if (missing.length > 0)
    throw forbidden(`You cannot grant permissions you do not have: ${missing.join(", ")}`);
}

/** Role names for the "assign a role" picker; needs only team.manage. */
export async function listRoleOptions(ctx: TenantContext) {
  requirePermission(ctx, "team.manage");
  const roles = await team.listRoles(prisma, ctx.businessId);
  return roles.map((role) => ({ id: role.id, name: role.name }));
}

export function listRoles(ctx: TenantContext) {
  requirePermission(ctx, "roles.manage");
  return team.listRoles(prisma, ctx.businessId);
}

export async function createRole(ctx: TenantContext, input: RoleInput) {
  requirePermission(ctx, "roles.manage");
  assertCanGrant(ctx, input.permissions);
  try {
    const role = await team.createRole(prisma, { ...input, businessId: ctx.businessId });
    await recordAction(ctx, "role.created", "role", role.id);
    return role;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("A role with this name already exists");
    throw error;
  }
}

export async function updateRole(ctx: TenantContext, roleId: string, input: Partial<RoleInput>) {
  requirePermission(ctx, "roles.manage");
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner) throw forbidden("The owner role cannot be changed");
  assertCanGrant(ctx, toPermissionList(role.permissions));
  if (input.permissions) assertCanGrant(ctx, input.permissions);
  await team.updateRole(prisma, ctx.businessId, roleId, input);
  await recordAction(ctx, "role.updated", "role", roleId);
}

export async function deleteRole(ctx: TenantContext, roleId: string) {
  requirePermission(ctx, "roles.manage");
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner) throw forbidden("The owner role cannot be deleted");
  if ((await team.countActiveMembersWithRole(prisma, roleId)) > 0) {
    throw conflict("Move the members on this role to another role first");
  }
  await team.deleteRole(prisma, ctx.businessId, roleId);
  await recordAction(ctx, "role.deleted", "role", roleId);
}

function toPermissionList(values: readonly string[]): Permission[] {
  return [...toPermissions(values)];
}

// ---------- Members ----------

export function listMembers(ctx: TenantContext) {
  requirePermission(ctx, "team.manage");
  return team.listMembers(prisma, ctx.businessId);
}

/** Only an owner may hand out the owner role; anyone else may only assign roles within their own permissions. */
async function findAssignableRole(ctx: TenantContext, roleId: string) {
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner && !ctx.isOwner) throw forbidden("Only an owner can make someone an owner");
  if (!role.isOwner) assertCanGrant(ctx, toPermissionList(role.permissions));
  return role;
}

export async function addMember(ctx: TenantContext, input: { email: string; roleId: string }) {
  requirePermission(ctx, "team.manage");
  const role = await findAssignableRole(ctx, input.roleId);
  const user = await team.findUserByEmail(prisma, input.email);
  if (!user) throw invalid("No account uses this email yet. Ask them to sign up first.");
  const membership = await team.upsertMembership(prisma, {
    userId: user.id,
    businessId: ctx.businessId,
    roleId: role.id,
  });
  await recordAction(ctx, "member.added", "membership", membership.id);
  return membership;
}

async function findManageableMember(ctx: TenantContext, membershipId: string) {
  requirePermission(ctx, "team.manage");
  if (membershipId === ctx.membershipId) throw forbidden("You cannot change your own access");
  const member = await team.findMembershipById(prisma, ctx.businessId, membershipId);
  if (!member) throw notFound("Member");
  if (member.role.isOwner && !ctx.isOwner) throw forbidden("Only an owner can change another owner");
  return member;
}

export async function changeMemberRole(ctx: TenantContext, membershipId: string, roleId: string) {
  await findManageableMember(ctx, membershipId);
  await findAssignableRole(ctx, roleId);
  await team.updateMembership(prisma, ctx.businessId, membershipId, { roleId });
  await recordAction(ctx, "member.role_changed", "membership", membershipId);
}

export async function removeMember(ctx: TenantContext, membershipId: string) {
  await findManageableMember(ctx, membershipId);
  await team.updateMembership(prisma, ctx.businessId, membershipId, { status: "REMOVED" });
  await recordAction(ctx, "member.removed", "membership", membershipId);
}
