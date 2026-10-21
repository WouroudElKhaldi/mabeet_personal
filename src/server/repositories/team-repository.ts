import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

const membershipWithRole = { role: true } satisfies Prisma.MembershipInclude;

export function findActiveMembership(db: Db, userId: string, businessId: string) {
  return db.membership.findFirst({
    where: { userId, businessId, status: "ACTIVE", business: { status: "ACTIVE" } },
    include: membershipWithRole,
  });
}

export function findMembershipById(db: Db, businessId: string, membershipId: string) {
  return db.membership.findFirst({
    where: { id: membershipId, businessId, status: "ACTIVE", business: { status: "ACTIVE" } },
    include: membershipWithRole,
  });
}

export function listUserWorkspaces(db: Db, userId: string) {
  return db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { business: { select: { id: true, name: true, slug: true } }, role: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function listMembers(db: Db, businessId: string) {
  return db.membership.findMany({
    where: { businessId, status: { not: "REMOVED" } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function upsertMembership(db: Db, data: { userId: string; businessId: string; roleId: string }) {
  return db.membership.upsert({
    where: { userId_businessId: { userId: data.userId, businessId: data.businessId } },
    create: data,
    update: { roleId: data.roleId, status: "ACTIVE" },
  });
}

export async function updateMembership(
  db: Db,
  businessId: string,
  membershipId: string,
  data: Prisma.MembershipUncheckedUpdateManyInput,
) {
  const { count } = await db.membership.updateMany({ where: { id: membershipId, businessId }, data });
  return count > 0;
}

export function findRole(db: Db, businessId: string, roleId: string) {
  return db.role.findFirst({ where: { id: roleId, businessId } });
}

export function listRoles(db: Db, businessId: string) {
  return db.role.findMany({
    where: { businessId },
    include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ isOwner: "desc" }, { name: "asc" }],
  });
}

export function createRole(db: Db, data: Prisma.RoleUncheckedCreateInput) {
  return db.role.create({ data });
}

export async function updateRole(
  db: Db,
  businessId: string,
  roleId: string,
  data: { name?: string; description?: string | null; permissions?: string[] },
) {
  const { count } = await db.role.updateMany({ where: { id: roleId, businessId, isOwner: false }, data });
  return count > 0;
}

export async function deleteRole(db: Db, businessId: string, roleId: string) {
  const { count } = await db.role.deleteMany({ where: { id: roleId, businessId, isOwner: false } });
  return count > 0;
}

export function countActiveMembersWithRole(db: Db, roleId: string) {
  return db.membership.count({ where: { roleId, status: "ACTIVE" } });
}

export function findUserByEmail(db: Db, email: string) {
  return db.user.findUnique({ where: { email: email.toLowerCase() } });
}
