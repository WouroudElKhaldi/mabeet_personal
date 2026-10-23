import type { Membership, Role } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  findUngrantable,
  type Permission,
  readOnly,
  toPermissions,
} from "@/server/auth/permissions";
import { type Channel, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { isUniqueViolation, prisma, runInTransaction } from "@/server/db/client";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import * as team from "@/server/repositories/team-repository";
import { recordAction } from "./audit";
import { assertPlanAllowsAnother } from "./billing-service";

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
    readOnly: !writeAccess,
  };
}

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** The places this person can act in, for an AI to choose from. */
export async function listMyPlaces(ctx: TenantContext) {
  const memberships = await team.listActiveMemberships(prisma, ctx.userId);
  return memberships.map((membership) => ({
    id: membership.businessId,
    name: membership.business.name,
    role: membership.role.name,
    current: membership.businessId === ctx.businessId,
  }));
}

/**
 * An AI working for a person across their places: the place they named (an id, a name or part of one), with
 * their own role's permissions there. Only places they belong to; a read-only key stays read-only; a name that
 * fits several places is refused rather than guessed. No place named: the one the key or chat belongs to.
 */
export async function resolvePlaceContext(
  ctx: TenantContext,
  place: string | undefined,
): Promise<TenantContext> {
  if (!place?.trim() || ctx.platformAdmin) return ctx;
  const memberships = await team.listActiveMemberships(prisma, ctx.userId);
  const wanted = normalize(place);
  const exact = memberships.filter(
    (membership) => membership.businessId === place.trim() || normalize(membership.business.name) === wanted,
  );
  const matches =
    exact.length > 0
      ? exact
      : memberships.filter((membership) => normalize(membership.business.name).includes(wanted));
  if (matches.length === 0) throw notFound("Place");
  if (matches.length > 1) {
    throw invalid(
      `Several of your places match "${place}": ${matches.map((match) => match.business.name).join(", ")}`,
    );
  }
  return contextFrom(matches[0]!, ctx.channel, !ctx.readOnly);
}

/**
 * Resolves the acting member for a signed-in user. A platform admin who isn't a member still gets in, with every
 * permission, so they can manage any business from their dashboard; only on the website, never through AI keys
 * or tokens. Returns null for anyone else who isn't an active member.
 */
export async function resolveContext(userId: string, businessId: string, channel: Channel = "web") {
  const membership = await team.findActiveMembership(prisma, userId, businessId);
  if (membership) return contextFrom(membership, channel);
  if (channel !== "web" || !(await team.findAdminAccess(prisma, userId, businessId))) return null;
  return {
    userId,
    businessId,
    membershipId: "",
    isOwner: true,
    permissions: new Set(ALL_PERMISSIONS),
    channel,
    platformAdmin: true,
  } satisfies TenantContext;
}

/** Resolves the member behind an OAuth access token: their own permissions, read-only unless the token may write. */
export async function resolveTokenContext(userId: string, businessId: string, canWrite: boolean) {
  const membership = await team.findActiveMembership(prisma, userId, businessId);
  return membership && contextFrom(membership, "mcp", canWrite);
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
  // The owner role goes last, so a new member never becomes an owner just by keeping the default choice.
  return [...roles.filter((role) => !role.isOwner), ...roles.filter((role) => role.isOwner)].map((role) => ({
    id: role.id,
    name: role.name,
  }));
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
  if ((await team.countMembersWithRole(prisma, roleId)) > 0) {
    throw conflict("Move the members on this role to another role first");
  }
  await runInTransaction((tx) => team.deleteRole(tx, ctx.businessId, roleId));
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
  // Adding never changes an existing member's role: that goes through changeMemberRole and its owner checks.
  const existing = await team.findMembershipOfUser(prisma, user.id, ctx.businessId);
  if (existing && existing.status !== "REMOVED") {
    throw conflict("This person is already on the team. Change their role from the team list instead.");
  }
  await assertPlanAllowsAnother(ctx.businessId, "members");
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
