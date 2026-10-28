import { randomUUID } from "node:crypto";
import type { Plan } from "@prisma/client";
import { addDays, todayUtc } from "@/lib/dates";
import { toPermissions, type Permission } from "@/server/auth/permissions";
import type { TenantContext } from "@/server/auth/tenant-context";
import { settleBackgroundWork } from "@/server/background";
import { prisma } from "@/server/db/client";
import { createWorkspace } from "@/server/services/onboarding-service";
import { createRoom } from "@/server/services/room-service";
import { resolveContext } from "@/server/services/team-service";

export { prisma };

export async function resetDatabase(): Promise<void> {
  // A previous test's emails may still be reading; truncating under them deadlocks Postgres.
  await settleBackgroundWork();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

export function createUser(name = "Test User") {
  const id = randomUUID();
  return prisma.user.create({ data: { id, name, email: `${id}@example.test` } });
}

async function ownerContext(user: { id: string }, businessId: string): Promise<TenantContext> {
  const ctx = await resolveContext(user.id, businessId);
  if (!ctx) throw new Error("expected an active membership");
  return ctx;
}

/** A workspace with one room, and its owner's context. On Business, so plan limits never get in the way. */
export async function createPlace(name = "Beit Test", plan: Plan = "BUSINESS") {
  const owner = await createUser(`${name} owner`);
  const business = await createWorkspace(owner.id, { name });
  await prisma.business.update({ where: { id: business.id }, data: { plan } });
  const ctx = await ownerContext(owner, business.id);
  const room = await createRoom(ctx, {
    name: "Cedar room",
    capacity: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    baseRateCents: 9_000,
    minNights: 1,
    amenities: ["wifi"],
  });
  return { owner, business, ctx, room };
}

/** Adds a user to a workspace on a custom role with exactly these permissions. */
export async function memberWith(businessId: string, permissions: Permission[]): Promise<TenantContext> {
  const user = await createUser("Staff");
  const role = await prisma.role.create({
    data: { businessId, name: `role-${randomUUID()}`, permissions: [...toPermissions(permissions)] },
  });
  await prisma.membership.create({ data: { userId: user.id, businessId, roleId: role.id } });
  return ownerContext(user, businessId);
}

/** A stay relative to today, so tests never fall into the past. */
export function stay(startOffset: number, nights: number) {
  const checkIn = addDays(todayUtc(), startOffset);
  return { checkIn, checkOut: addDays(checkIn, nights) };
}

export function guestRequest(slug: string, roomId: string, startOffset: number, nights: number) {
  return {
    businessSlug: slug,
    roomId,
    range: stay(startOffset, nights),
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: "maya@example.test",
    guestNote: null,
    guestUserId: null,
  };
}
