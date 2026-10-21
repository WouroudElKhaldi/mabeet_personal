import { beforeAll, describe, expect, it } from "vitest";
import * as bookingAction from "@/app/api/workspaces/[businessId]/bookings/[bookingId]/[action]/route";
import * as booking from "@/app/api/workspaces/[businessId]/bookings/[bookingId]/route";
import * as bookingList from "@/app/api/workspaces/[businessId]/bookings/route";
import * as memberItem from "@/app/api/workspaces/[businessId]/members/[membershipId]/route";
import * as members from "@/app/api/workspaces/[businessId]/members/route";
import * as roleItem from "@/app/api/workspaces/[businessId]/roles/[roleId]/route";
import * as roles from "@/app/api/workspaces/[businessId]/roles/route";
import * as room from "@/app/api/workspaces/[businessId]/rooms/[roomId]/route";
import * as roomList from "@/app/api/workspaces/[businessId]/rooms/route";
import * as workspaces from "@/app/api/workspaces/route";
import { requestBooking } from "@/server/services/booking-service";
import { guestRequest, prisma, resetDatabase } from "./helpers";
import { call, type Caller, signUp } from "./http";

interface Tenant {
  owner: Caller;
  businessId: string;
  slug: string;
  roomId: string;
  bookingId: string;
  roleId: string;
  membershipId: string;
}

const ROOM = { name: "Sea view", capacity: 2, baseRateCents: 10_000 };

async function createTenant(name: string): Promise<Tenant> {
  const owner = await signUp(`${name} owner`);
  const created = await call(workspaces.POST, { as: owner, body: { name } });
  const { id: businessId, slug } = created.body as { id: string; slug: string };
  const createdRoom = await call(roomList.POST, { as: owner, params: { businessId }, body: ROOM });
  const roomId = (createdRoom.body as { id: string }).id;
  const held = await requestBooking(guestRequest(slug, roomId, 12, 2));
  const role = await prisma.role.findFirstOrThrow({ where: { businessId, isOwner: false } });
  const membership = await prisma.membership.findFirstOrThrow({ where: { businessId } });
  return {
    owner,
    businessId,
    slug,
    roomId,
    bookingId: held.id,
    roleId: role.id,
    membershipId: membership.id,
  };
}

/**
 * The Definition of Done asks for proof that one business cannot read another's data.
 * Business A's owner, fully signed in, aims every endpoint at Business B and must get 404 every time.
 */
describe("tenant isolation over HTTP", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    await resetDatabase();
    a = await createTenant("Beit Alpha");
    b = await createTenant("Beit Bravo");
  });

  it("returns 401 without a session", async () => {
    expect((await call(roomList.GET, { params: { businessId: a.businessId } })).status).toBe(401);
  });

  it("works for the owner's own workspace", async () => {
    const own = await call(roomList.GET, { as: a.owner, params: { businessId: a.businessId } });
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
  });

  it("hides another workspace entirely, even when its ids are known", async () => {
    const asA = { as: a.owner };
    const attempts = [
      call(roomList.GET, { ...asA, params: { businessId: b.businessId } }),
      call(roomList.POST, { ...asA, params: { businessId: b.businessId }, body: ROOM }),
      call(room.GET, { ...asA, params: { businessId: b.businessId, roomId: b.roomId } }),
      call(bookingList.GET, { ...asA, params: { businessId: b.businessId } }),
      call(booking.GET, { ...asA, params: { businessId: b.businessId, bookingId: b.bookingId } }),
      call(bookingAction.POST, {
        ...asA,
        params: { businessId: b.businessId, bookingId: b.bookingId, action: "confirm" },
        body: {},
      }),
      call(roles.GET, { ...asA, params: { businessId: b.businessId } }),
      call(roleItem.DELETE, { ...asA, params: { businessId: b.businessId, roleId: b.roleId } }),
      call(members.GET, { ...asA, params: { businessId: b.businessId } }),
      call(memberItem.DELETE, { ...asA, params: { businessId: b.businessId, membershipId: b.membershipId } }),
    ];
    for (const response of await Promise.all(attempts)) expect(response.status).toBe(404);
  });

  it("ignores B's ids smuggled into A's own workspace URLs", async () => {
    const asA = { as: a.owner };
    const attempts = [
      call(room.GET, { ...asA, params: { businessId: a.businessId, roomId: b.roomId } }),
      call(room.PATCH, {
        ...asA,
        params: { businessId: a.businessId, roomId: b.roomId },
        body: { name: "Mine" },
      }),
      call(booking.GET, { ...asA, params: { businessId: a.businessId, bookingId: b.bookingId } }),
      call(bookingAction.POST, {
        ...asA,
        params: { businessId: a.businessId, bookingId: b.bookingId, action: "cancel" },
        body: {},
      }),
      call(roleItem.DELETE, { ...asA, params: { businessId: a.businessId, roleId: b.roleId } }),
      call(memberItem.DELETE, { ...asA, params: { businessId: a.businessId, membershipId: b.membershipId } }),
    ];
    for (const response of await Promise.all(attempts)) expect(response.status).toBe(404);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: b.bookingId } })).toMatchObject({
      status: "HELD",
    });
    expect(await prisma.room.findUniqueOrThrow({ where: { id: b.roomId } })).toMatchObject({
      name: ROOM.name,
    });
  });

  it("never lists B's rows in A's lists", async () => {
    const bookings = await call(bookingList.GET, { as: a.owner, params: { businessId: a.businessId } });
    const ids = (bookings.body as { id: string }[]).map((row) => row.id);
    expect(ids).toEqual([a.bookingId]);
  });
});
