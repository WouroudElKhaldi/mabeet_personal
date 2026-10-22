import { beforeEach, describe, expect, it } from "vitest";
import { POST as mcp } from "@/app/api/mcp/route";
import { createKey, revokeKey } from "@/server/services/api-key-service";
import { requestBooking } from "@/server/services/booking-service";
import { removeMember } from "@/server/services/team-service";
import { createPlace, guestRequest, memberWith, resetDatabase } from "./helpers";

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
    expect(names).toEqual(["check_availability", "get_calendar"]);
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
