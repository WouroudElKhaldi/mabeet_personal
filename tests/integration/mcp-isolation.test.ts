import { beforeEach, describe, expect, it } from "vitest";
import { POST as mcp } from "@/app/api/mcp/route";
import { createKey, revokeKey } from "@/server/services/api-key-service";
import { requestBooking } from "@/server/services/booking-service";
import { removeMember } from "@/server/services/team-service";
import { createPlace, guestRequest, memberWith, prisma, resetDatabase } from "./helpers";

async function callMcp(secret: string | null, method: string, params: unknown) {
  const request = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(secret && { authorization: `Bearer ${secret}` }),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const response = await mcp(request, { params: Promise.resolve({}) });
  return { status: response.status, body: (await response.json()) as { result?: Record<string, unknown> } };
}

const toolText = (body: { result?: Record<string, unknown> }) =>
  (body.result?.content as Array<{ text: string }>)[0]!.text;

describe("owner MCP: keys, permissions and tenant isolation", () => {
  let a: Awaited<ReturnType<typeof createPlace>>;
  let b: Awaited<ReturnType<typeof createPlace>>;
  let referenceB: string;

  beforeEach(async () => {
    await resetDatabase();
    a = await createPlace("Beit Alpha");
    b = await createPlace("Beit Bravo");
    await requestBooking(guestRequest(a.business.slug, a.room.id, 10, 2));
    referenceB = (await requestBooking(guestRequest(b.business.slug, b.room.id, 10, 2))).reference;
  });

  it("refuses requests without a valid key", async () => {
    expect((await callMcp(null, "tools/list", {})).status).toBe(401);
    expect((await callMcp("mbt_not-a-real-key", "tools/list", {})).status).toBe(401);
  });

  it("cannot read another business's booking even with its reference", async () => {
    const { secret } = await createKey(a.ctx, { name: "test", canWrite: false, expiresInDays: 30 });
    const { body } = await callMcp(secret, "tools/call", {
      name: "get_booking",
      arguments: { reference: referenceB },
    });
    expect(body.result?.isError).toBe(true);
    expect(toolText(body)).toContain("not found");
  });

  it("lists only its own business's bookings", async () => {
    const { secret } = await createKey(a.ctx, { name: "test", canWrite: false, expiresInDays: 30 });
    const { body } = await callMcp(secret, "tools/call", { name: "list_bookings", arguments: {} });
    const rows = JSON.parse(toolText(body)) as Array<{ reference: string }>;
    expect(rows).toHaveLength(1);
    expect(rows.map((row) => row.reference)).not.toContain(referenceB);
  });

  it("hides write tools from read-only keys", async () => {
    const { secret } = await createKey(a.ctx, { name: "test", canWrite: false, expiresInDays: 30 });
    const { body } = await callMcp(secret, "tools/list", {});
    const names = (body.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toContain("list_bookings");
    expect(names).not.toContain("confirm_booking");
  });

  it("gives a staff key only the tools its role allows", async () => {
    const housekeeping = await memberWith(a.business.id, ["calendar.read", "ai.use"]);
    const { secret } = await createKey(housekeeping, { name: "test", canWrite: true, expiresInDays: 30 });
    const { body } = await callMcp(secret, "tools/list", {});
    const names = (body.result?.tools as Array<{ name: string }>).map((tool) => tool.name).sort();
    expect(names).toEqual(["check_availability", "get_calendar", "list_places"]);
  });

  it("works across every place the owner runs, with their role in each", async () => {
    // The same owner runs both places; a key made in Alpha reaches Bravo when asked about it.
    await prisma.membership.update({ where: { id: b.ctx.membershipId }, data: { userId: a.owner.id } });
    const { secret } = await createKey(a.ctx, { name: "test", canWrite: false, expiresInDays: 30 });
    const { body: list } = await callMcp(secret, "tools/list", {});
    const names = (list.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_places",
        "get_analytics",
        "get_booking_setup",
        "get_payouts",
        "list_notifications",
      ]),
    );
    // Read-only stays read-only in every place.
    expect(names).not.toContain("confirm_booking");

    const call = async (name: string, args: Record<string, unknown>) =>
      JSON.parse(toolText((await callMcp(secret, "tools/call", { name, arguments: args })).body)) as unknown;
    const places = (await call("list_places", {})) as Array<{ name: string }>;
    expect(places.map((place) => place.name).sort()).toEqual(["Beit Alpha", "Beit Bravo"]);
    const all = (await call("get_analytics", { from: "2026-01-01", to: "2027-12-31", scope: "all" })) as {
      places: unknown[];
    };
    expect(all.places).toHaveLength(2);
    const bravo = (await call("list_bookings", { place: "bravo" })) as Array<{ reference: string }>;
    expect(bravo.map((row) => row.reference)).toEqual([referenceB]);
    expect(await call("get_booking_setup", {})).toMatchObject({
      bookingUnit: "ROOMS",
      bookingMode: "REQUEST",
    });
  });

  it("never reaches a place the member doesn't belong to", async () => {
    const frontDesk = await memberWith(a.business.id, ["bookings.read", "calendar.read", "ai.use"]);
    const { secret } = await createKey(frontDesk, { name: "test", canWrite: false, expiresInDays: 30 });
    const { body: list } = await callMcp(secret, "tools/list", {});
    expect((list.result?.tools as Array<{ name: string }>).map((tool) => tool.name)).not.toContain(
      "get_payouts",
    );
    const { body } = await callMcp(secret, "tools/call", {
      name: "list_bookings",
      arguments: { place: "Beit Bravo" },
    });
    expect(body.result?.isError).toBe(true);
    expect(toolText(body)).toContain("not found");
  });

  it("stops working the moment a key is revoked or its member is removed", async () => {
    const own = await createKey(a.ctx, { name: "test", canWrite: false, expiresInDays: 30 });
    await revokeKey(a.ctx, own.id);
    expect((await callMcp(own.secret, "tools/list", {})).status).toBe(401);

    const staff = await memberWith(a.business.id, ["bookings.read", "ai.use"]);
    const staffKey = await createKey(staff, { name: "test", canWrite: false, expiresInDays: 30 });
    await removeMember(a.ctx, staff.membershipId);
    expect((await callMcp(staffKey.secret, "tools/list", {})).status).toBe(401);
  });
});
