/**
 * The "what can go wrong" run against a running app (default http://localhost:3000, or SMOKE_URL).
 * Tries the bad paths on purpose, for every kind of user: bad input, taken dates, finished bookings,
 * forbidden screens and actions, other businesses' ids, broken links and abuse of public endpoints.
 * Each check expects a clear refusal with the right status, never a crash or a leak.
 * Run: pnpm edge-cases (with the app and the database running, after pnpm db:seed).
 * Cleans up everything it creates.
 */
import { randomUUID } from "node:crypto";
import { check, db, finish, http, isNotFound, isoIn, send, signIn, signInResponse } from "./lib/e2e";

const GUEST_NAME = "Edge Case Guest";
const OUTSIDER_EMAIL = `outsider-${randomUUID().slice(0, 8)}@example.test`;

type Body = Record<string, unknown>;
const errorFields = (body: Body) =>
  Object.keys((body.error as { details?: { fieldErrors?: Body } } | undefined)?.details?.fieldErrors ?? {});

/** Expects a refusal with this status (and, for 400s, that the named fields are reported). */
function refused(
  name: string,
  result: { status: number; body: Body },
  status: number,
  fields: string[] = [],
) {
  const reported = errorFields(result.body);
  const ok = result.status === status && fields.every((field) => reported.includes(field));
  check(name, ok, `status ${result.status}${reported.length ? `, fields ${reported.join(",")}` : ""}`);
}

async function main() {
  await cleanUp();
  await db.rateLimitWindow.deleteMany({});

  const host = await db.user.findUniqueOrThrow({ where: { email: "host@mabeet.test" } });
  const place = await db.business.findFirstOrThrow({
    where: { listedPublicly: true, status: "ACTIVE", memberships: { some: { userId: host.id } } },
    include: { rooms: { where: { active: true }, orderBy: { capacity: "asc" } } },
  });
  const room = place.rooms[0]!;
  const bookingsUrl = `/api/public/places/${place.slug}/bookings`;
  // Public bookings are limited to 5 an hour per address; this run sends far more, so each starts a fresh window.
  const book = async (body: unknown) => {
    await db.rateLimitWindow.deleteMany({});
    return send("POST", bookingsUrl, body);
  };
  const stay = (from: number, nights: number, extra: Body = {}) => ({
    roomId: room.id,
    checkIn: isoIn(from),
    checkOut: isoIn(from + nights),
    guestCount: 1,
    guestName: GUEST_NAME,
    guestPhone: `+9617${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
    ...extra,
  });
  const offset = 300 + Math.floor(Math.random() * 60);

  // ---------- Signed-out guest: bad booking requests ----------
  refused("booking: no body at all", await book(undefined), 400);
  refused(
    "booking: every field wrong is reported field by field",
    await book({ roomId: "", guestCount: 0, guestName: "A", guestPhone: "123" }),
    400,
    ["guestCount", "guestName", "guestPhone"],
  );
  refused("booking: email that isn't an email", await book(stay(offset, 1, { guestEmail: "nope" })), 400, [
    "guestEmail",
  ]);
  refused(
    "booking: check-out before check-in",
    await book({ ...stay(offset, 1), checkOut: isoIn(offset - 1) }),
    400,
  );
  refused("booking: dates in the past", await book(stay(-5, 2)), 400);
  refused(
    "booking: impossible date (30 February)",
    await book({ ...stay(offset, 1), checkIn: "2027-02-30" }),
    400,
  );
  refused("booking: more than 60 nights", await book(stay(offset, 61)), 400);
  refused(
    "booking: more guests than the room sleeps",
    await book(stay(offset, 1, { guestCount: room.capacity + 1 })),
    400,
  );
  refused(
    "booking: a note longer than 1000 characters",
    await book(stay(offset, 1, { guestNote: "x".repeat(1001) })),
    400,
    ["guestNote"],
  );
  refused("booking: a room that doesn't exist", await book(stay(offset, 1, { roomId: "no-such-room" })), 404);
  refused(
    "booking: a place that doesn't exist",
    await send("POST", "/api/public/places/no-such-place/bookings", stay(offset, 1)),
    404,
  );

  const held = await book(stay(offset, 2));
  check("booking: a valid request is held (201)", held.status === 201, `status ${held.status}`);
  const publicToken = String(held.body.publicToken);
  refused("booking: the same nights again are refused as taken", await book(stay(offset, 2)), 409);
  refused("booking: nights overlapping by one are refused", await book(stay(offset + 1, 2)), 409);
  const backToBack = await book(stay(offset + 2, 1));
  check(
    "booking: arriving the day the last guest leaves is fine",
    backToBack.status === 201,
    `status ${backToBack.status}`,
  );

  const xss = await book(stay(offset + 10, 1, { guestName: `<script>alert(1)</script>${GUEST_NAME}` }));
  const xssPage = await (await http(`/b/${String(xss.body.publicToken)}`)).text();
  check(
    "a name with <script> is shown as text, never run",
    xss.status === 201 && !xssPage.includes("<script>alert(1)</script>"),
  );

  // ---------- Quotes, calendars, links ----------
  check(
    "quote: missing dates -> 400",
    (await http(`/api/public/places/${place.slug}/rooms/${room.id}/quote`)).status === 400,
  );
  check(
    "quote: nonsense dates -> 400",
    (await http(`/api/public/places/${place.slug}/rooms/${room.id}/quote?checkIn=tomorrow&checkOut=later`))
      .status === 400,
  );
  check(
    "availability: a window over 400 days -> 400",
    (
      await http(
        `/api/public/places/${place.slug}/rooms/${room.id}/availability?from=${isoIn(0)}&to=${isoIn(500)}`,
      )
    ).status === 400,
  );
  check(
    "iCal: an unknown calendar link -> 404",
    (await http("/api/ical/this-token-does-not-exist-anywhere.ics")).status === 404,
  );
  check(
    "confirmation: a made-up link shows not found",
    await isNotFound(await http("/b/made-up-token-that-is-long-enough-00")),
  );
  check("place: an unknown page shows not found", await isNotFound(await http("/p/no-such-place-anywhere")));
  check(
    "experience: an unknown page shows not found",
    await isNotFound(await http("/o/no-such-experience-anywhere")),
  );

  // ---------- Guest cancels through the private link ----------
  refused(
    "cancel: a made-up link",
    await send("POST", "/api/public/bookings/made-up-token-that-is-long-enough-00/cancel", {}),
    404,
  );
  const cancelled = await send("POST", `/api/public/bookings/${publicToken}/cancel`, {
    reason: "Plans changed",
  });
  check(
    "cancel: the guest cancels their own held booking",
    cancelled.status === 200 && cancelled.body.status === "CANCELLED",
    `status ${cancelled.status}`,
  );
  refused(
    "cancel: cancelling twice is refused",
    await send("POST", `/api/public/bookings/${publicToken}/cancel`, {}),
    409,
  );
  const rebook = await book(stay(offset, 2));
  check("cancelled nights are free again", rebook.status === 201, `status ${rebook.status}`);

  // ---------- Signed-out visitor: private areas ----------
  check(
    "signed out: workspace API -> 401",
    (await http(`/api/workspaces/${place.id}/bookings`)).status === 401,
  );
  check("signed out: my bookings API -> 401", (await http("/api/me/bookings")).status === 401);
  const dashboard = await http(`/dashboard/${place.id}`);
  check(
    "signed out: dashboard sends you to sign in",
    [302, 303, 307].includes(dashboard.status) &&
      (dashboard.headers.get("location") ?? "").includes("/sign-in"),
    `status ${dashboard.status}`,
  );
  check(
    "a forged session cookie is just signed out",
    (await http("/api/me/bookings", { cookie: "better-auth.session_token=forged.value" })).status === 401,
  );
  check(
    "wrong password is refused",
    (await signInResponse("host@mabeet.test", "wrong-password-123")).status === 401,
  );

  // ---------- Signed-in guest ----------
  const guestCookie = await signIn("guest@mabeet.test");
  const guestBooking = await db.booking.findUniqueOrThrow({
    where: { publicToken: String(rebook.body.publicToken) },
  });
  refused(
    "review: someone else's stay",
    await send(
      "POST",
      "/api/me/reviews",
      { bookingId: guestBooking.id, rating: 5, comment: "Lovely stay, would come back." },
      guestCookie,
    ),
    404,
  );
  refused(
    "review: rating of 6 stars",
    await send(
      "POST",
      "/api/me/reviews",
      { bookingId: guestBooking.id, rating: 6, comment: "Lovely stay, would come back." },
      guestCookie,
    ),
    400,
  );
  refused(
    "review: a comment that's too short",
    await send(
      "POST",
      "/api/me/reviews",
      { bookingId: guestBooking.id, rating: 4, comment: "ok" },
      guestCookie,
    ),
    400,
  );
  check(
    "guest: host workspace API -> 404",
    (await http(`/api/workspaces/${place.id}/rooms`, { cookie: guestCookie })).status === 404,
  );
  refused(
    "guest: cannot create a room in someone's place",
    await send(
      "POST",
      `/api/workspaces/${place.id}/rooms`,
      { name: "Mine", capacity: 2, baseRateCents: 100 },
      guestCookie,
    ),
    404,
  );
  refused(
    "guest: cannot suspend a business",
    await send("PATCH", `/api/admin/businesses/${place.id}`, { status: "SUSPENDED" }, guestCookie),
    403,
  );

  // ---------- Owner: wrong moves on purpose ----------
  const hostCookie = await signIn("host@mabeet.test");
  const ws = `/api/workspaces/${place.id}`;
  const booking = await db.booking.findUniqueOrThrow({
    where: { publicToken: String(rebook.body.publicToken) },
  });
  refused(
    "owner: a booking id that doesn't exist",
    await send("POST", `${ws}/bookings/no-such-booking/confirm`, {}, hostCookie),
    404,
  );
  refused(
    "owner: an action that doesn't exist",
    await send("POST", `${ws}/bookings/${booking.id}/approve-everything`, {}, hostCookie),
    400,
  );
  refused(
    "owner: decline reason longer than 500 characters",
    await send("POST", `${ws}/bookings/${booking.id}/decline`, { reason: "x".repeat(501) }, hostCookie),
    400,
  );
  const declined = await send(
    "POST",
    `${ws}/bookings/${booking.id}/decline`,
    { reason: "Closed that week" },
    hostCookie,
  );
  check("owner: declines a request", declined.status === 200 && declined.body.status === "DECLINED");
  refused(
    "owner: confirming a declined booking is refused",
    await send("POST", `${ws}/bookings/${booking.id}/confirm`, {}, hostCookie),
    409,
  );
  refused(
    "owner: recording a deposit on a declined booking is refused",
    await send(
      "POST",
      `${ws}/bookings/${booking.id}/payments`,
      { amountCents: 1000, method: "CASH" },
      hostCookie,
    ),
    409,
  );
  refused(
    "owner: a negative deposit",
    await send(
      "POST",
      `${ws}/bookings/${booking.id}/payments`,
      { amountCents: -5, method: "CASH" },
      hostCookie,
    ),
    400,
    ["amountCents"],
  );
  refused(
    "owner: an unknown payment method",
    await send(
      "POST",
      `${ws}/bookings/${booking.id}/payments`,
      { amountCents: 500, method: "BITCOIN" },
      hostCookie,
    ),
    400,
    ["method"],
  );

  const fresh = await book(stay(offset + 20, 2));
  const freshBooking = await db.booking.findUniqueOrThrow({
    where: { publicToken: String(fresh.body.publicToken) },
  });
  refused(
    "owner: closing dates a guest already holds is refused",
    await send(
      "POST",
      `${ws}/blocks`,
      { roomId: room.id, checkIn: isoIn(offset + 20), checkOut: isoIn(offset + 21) },
      hostCookie,
    ),
    409,
  );
  refused(
    "owner: a block for a room of another place",
    await send(
      "POST",
      `${ws}/blocks`,
      { roomId: "no-such-room", checkIn: isoIn(offset + 40), checkOut: isoIn(offset + 41) },
      hostCookie,
    ),
    404,
  );
  refused(
    "owner: removing a block that doesn't exist",
    await send("DELETE", `${ws}/blocks/no-such-block`, undefined, hostCookie),
    404,
  );
  refused(
    "owner: a calendar link over plain http",
    await send(
      "POST",
      `${ws}/feeds`,
      { roomId: room.id, url: "http://example.com/feed.ics", source: "AIRBNB" },
      hostCookie,
    ),
    400,
  );
  refused(
    "owner: a calendar link pointing inside the network",
    await send(
      "POST",
      `${ws}/feeds`,
      { roomId: room.id, url: "https://127.0.0.1/feed.ics", source: "AIRBNB" },
      hostCookie,
    ),
    400,
  );
  refused(
    "owner: a calendar link to the cloud metadata address",
    await send(
      "POST",
      `${ws}/feeds`,
      { roomId: room.id, url: "https://169.254.169.254/latest/meta-data", source: "OTHER" },
      hostCookie,
    ),
    400,
  );
  refused(
    "owner: a room with a negative price",
    await send("POST", `${ws}/rooms`, { name: "Bad", capacity: 2, baseRateCents: -1 }, hostCookie),
    400,
    ["baseRateCents"],
  );
  refused(
    "owner: a room for 0 guests",
    await send("POST", `${ws}/rooms`, { name: "Bad", capacity: 0, baseRateCents: 1000 }, hostCookie),
    400,
    ["capacity"],
  );
  refused(
    "owner: a role with a made-up permission",
    await send("POST", `${ws}/roles`, { name: "Hacker", permissions: ["everything.all"] }, hostCookie),
    400,
  );
  const ownerRole = await db.role.findFirstOrThrow({ where: { businessId: place.id, isOwner: true } });
  refused(
    "owner: the owner role cannot be deleted",
    await send("DELETE", `${ws}/roles/${ownerRole.id}`, undefined, hostCookie),
    403,
  );
  refused(
    "owner: the owner role cannot be edited",
    await send("PATCH", `${ws}/roles/${ownerRole.id}`, { name: "Boss" }, hostCookie),
    403,
  );
  const hostMembership = await db.membership.findFirstOrThrow({
    where: { businessId: place.id, userId: host.id },
  });
  refused(
    "owner: cannot remove themselves",
    await send("DELETE", `${ws}/members/${hostMembership.id}`, undefined, hostCookie),
    403,
  );
  refused(
    "owner: inviting an email with no account",
    await send(
      "POST",
      `${ws}/members`,
      { email: "nobody-here@example.test", roleId: ownerRole.id },
      hostCookie,
    ),
    400,
  );
  refused(
    "owner: settings with a deposit over 100%",
    await send("PATCH", `${ws}/settings`, { depositPercent: 150 }, hostCookie),
    400,
    ["depositPercent"],
  );
  refused(
    "owner: settings with an unknown currency",
    await send("PATCH", `${ws}/settings`, { currency: "BTC" }, hostCookie),
    400,
    ["currency"],
  );
  refused(
    "owner: an AI key that never expires past a year",
    await send("POST", `${ws}/keys`, { name: "k", expiresInDays: 999 }, hostCookie),
    400,
  );

  const crossSite = await http(`${ws}/settings`, {
    method: "PATCH",
    cookie: hostCookie,
    headers: { origin: "https://evil.example", "content-type": "text/plain" },
    body: JSON.stringify({ houseRules: "changed from another site" }),
  });
  check(
    "owner: a write coming from another website is refused (403)",
    crossSite.status === 403,
    `status ${crossSite.status}`,
  );

  // ---------- Front-desk staff: allowed vs refused ----------
  const staffCookie = await signIn("staff@mabeet.test");
  const staffPlace = await db.business.findFirstOrThrow({
    where: { memberships: { some: { user: { email: "staff@mabeet.test" } } } },
  });
  const staffWs = `/api/workspaces/${staffPlace.id}`;
  for (const [path, status] of [
    ["/bookings", 200],
    ["/rooms", 200],
    [`/calendar?from=${isoIn(0)}&to=${isoIn(30)}`, 200],
    [`/analytics?from=${isoIn(-30)}&to=${isoIn(1)}`, 403],
    ["/settings", 403],
    ["/roles", 403],
    ["/members", 403],
    ["/feeds", 403],
    ["/keys", 403],
  ] as const) {
    const response = await http(`${staffWs}${path}`, { cookie: staffCookie });
    check(
      `front desk: GET ${path.split("?")[0]} -> ${status}`,
      response.status === status,
      `status ${response.status}`,
    );
  }
  refused(
    "front desk: cannot add a room",
    await send("POST", `${staffWs}/rooms`, { name: "Sneaky", capacity: 2, baseRateCents: 1000 }, staffCookie),
    403,
  );
  refused(
    "front desk: cannot make themselves a role",
    await send("POST", `${staffWs}/roles`, { name: "Me", permissions: ["settings.manage"] }, staffCookie),
    403,
  );
  refused(
    "front desk: cannot touch another place of the same owner",
    await send("POST", `${ws}/rooms`, { name: "Sneaky", capacity: 2, baseRateCents: 1000 }, staffCookie),
    place.id === staffPlace.id ? 403 : 404,
  );
  const settingsPage = await http(`/dashboard/${staffPlace.id}/settings`, { cookie: staffCookie });
  check(
    "front desk: the settings screen is refused",
    settingsPage.status !== 200 || (await isNotFound(settingsPage)),
    `status ${settingsPage.status}`,
  );

  // ---------- Another business's owner (outsider) ----------
  const signUp = await send("POST", "/api/auth/sign-up/email", {
    name: "Outsider Owner",
    email: OUTSIDER_EMAIL,
    password: "outsider-password-1",
  });
  await db.user.update({ where: { email: OUTSIDER_EMAIL }, data: { emailVerified: true } });
  check("outsider: signs up", signUp.status === 200, `status ${signUp.status}`);
  const outsiderCookie = await signIn(OUTSIDER_EMAIL, "outsider-password-1");
  const ownPlace = await send("POST", "/api/workspaces", { name: "Outsider Lodge" }, outsiderCookie);
  check("outsider: creates their own workspace", ownPlace.status === 201, `status ${ownPlace.status}`);
  for (const [method, path] of [
    ["GET", `${ws}/bookings`],
    ["GET", `${ws}/bookings/${freshBooking.id}`],
    ["POST", `${ws}/bookings/${freshBooking.id}/confirm`],
    ["GET", `${ws}/settings`],
    ["GET", `${ws}/members`],
  ] as const) {
    const response = await http(path, {
      method,
      cookie: outsiderCookie,
      body: method === "POST" ? "{}" : undefined,
    });
    check(
      `outsider: ${method} ${path.replace(ws, "<their place>")} -> 404`,
      response.status === 404,
      `status ${response.status}`,
    );
  }
  refused(
    "outsider: B's booking smuggled into their own workspace URL",
    await send(
      "POST",
      `/api/workspaces/${String(ownPlace.body.id)}/bookings/${freshBooking.id}/confirm`,
      {},
      outsiderCookie,
    ),
    404,
  );
  check(
    "the smuggled confirm changed nothing",
    (await db.booking.findUniqueOrThrow({ where: { id: freshBooking.id } })).status === "HELD",
  );

  // ---------- Super admin ----------
  const adminCookie = await signIn("admin@mabeet.test");
  refused(
    "admin: an unknown status",
    await send("PATCH", `/api/admin/businesses/${place.id}`, { status: "DELETED" }, adminCookie),
    400,
  );
  refused(
    "admin: a business that doesn't exist",
    await send("PATCH", "/api/admin/businesses/no-such-business", { status: "SUSPENDED" }, adminCookie),
    404,
  );
  const outsiderBusinessId = String(ownPlace.body.id);
  const suspend = await send(
    "PATCH",
    `/api/admin/businesses/${outsiderBusinessId}`,
    { status: "SUSPENDED" },
    adminCookie,
  );
  check("admin: suspends a business", suspend.status === 200);
  check(
    "suspended: its owner loses dashboard access",
    (await http(`/api/workspaces/${outsiderBusinessId}/rooms`, { cookie: outsiderCookie })).status === 404,
  );

  // ---------- Public AI endpoints ----------
  refused("concierge: an empty conversation", await send("POST", "/api/assistant", { messages: [] }), 400);
  refused(
    "concierge: the last message isn't the guest's",
    await send("POST", "/api/assistant", { messages: [{ role: "assistant", content: "hi" }] }),
    400,
  );
  refused(
    "concierge: a message over 2000 characters",
    await send("POST", "/api/assistant", { messages: [{ role: "user", content: "x".repeat(2001) }] }),
    400,
  );
  const mcpCall = (params: Body) =>
    http("/api/mcp/guest", {
      method: "POST",
      headers: { accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params }),
    }).then((response) => response.text());
  check(
    "guest MCP: an unknown tool is an error, not a crash",
    (await mcpCall({ name: "delete_everything", arguments: {} })).includes("error"),
  );
  check(
    "guest MCP: bad arguments are refused",
    (
      await mcpCall({ name: "check_availability", arguments: { slug: place.slug, checkIn: "soon" } })
    ).includes('isError":true'),
  );
  check(
    "cron: a wrong secret is refused",
    (await http("/api/cron/sync-feeds", { method: "POST", headers: { authorization: "Bearer wrong" } }))
      .status === 401,
  );

  await cleanUp();
  await finish();
}

/** Removes only what this script created: its bookings, the outsider and their workspace. */
async function cleanUp() {
  await db.booking.deleteMany({ where: { guestName: { contains: GUEST_NAME } } });
  await db.business.deleteMany({
    where: { memberships: { some: { user: { email: { startsWith: "outsider-" } } } } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: "outsider-" } } });
}

main().catch(async (error: unknown) => {
  console.error(error);
  await cleanUp();
  process.exit(1);
});
