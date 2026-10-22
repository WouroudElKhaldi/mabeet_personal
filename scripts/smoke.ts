/**
 * End-to-end smoke test against a running app (default http://localhost:3000, or SMOKE_URL).
 * Drives the real HTTP API as a guest, a host, an admin and an outsider. Uses the seeded demo data.
 * Run: pnpm smoke (with pnpm dev and the database running). Cleans up the bookings it creates.
 */
import { BASE, check, db, finish, http, isNotFound, isoIn, signIn } from "./lib/e2e";

async function main() {
  // Leftovers from an interrupted earlier run would skew the checks.
  await db.booking.deleteMany({ where: { guestName: "E2E Guest" } });
  await db.sessionBooking.deleteMany({ where: { guestName: "E2E Guest" } });
  // Rate limits live in the database now; start each run with fresh windows (development database only).
  await db.rateLimitWindow.deleteMany({});

  // ---------- Public pages ----------
  for (const path of ["/", "/search", "/host", "/privacy", "/sign-in", "/sign-up", "/assistant"]) {
    const response = await http(path);
    check(`GET ${path}`, response.status === 200, `status ${response.status}`);
  }
  const home = await http("/");
  check(
    "security headers (CSP, HSTS, nosniff)",
    Boolean(
      home.headers.get("content-security-policy") &&
      home.headers.get("strict-transport-security") &&
      home.headers.get("x-content-type-options"),
    ),
  );
  const arabic = await (await http("/", { cookie: "locale=ar" })).text();
  check("Arabic locale renders right-to-left", arabic.includes('dir="rtl"') && arabic.includes('lang="ar"'));

  const place = await db.business.findFirstOrThrow({
    where: { listedPublicly: true, status: "ACTIVE" },
    include: { rooms: { where: { active: true } } },
  });
  const room = place.rooms[0]!;
  check(
    "seeded Arabic category text survived the database",
    (await db.category.findFirstOrThrow()).nameAr.length > 0 &&
      /[؀-ۿ]/.test((await db.category.findFirstOrThrow()).nameAr),
  );
  check(`GET /p/${place.slug}`, (await http(`/p/${place.slug}`)).status === 200);
  check("unknown place shows not found", await isNotFound(await http("/p/no-such-place-xyz")));

  // ---------- Guest booking flow ----------
  const checkIn = isoIn(200 + Math.floor(Math.random() * 100));
  const checkOut = new Date(Date.parse(checkIn) + 2 * 86_400_000).toISOString().slice(0, 10);
  const quote = await http(
    `/api/public/places/${place.slug}/rooms/${room.id}/quote?checkIn=${checkIn}&checkOut=${checkOut}`,
  );
  const quoteBody = (await quote.json()) as { free: boolean; totalCents: number };
  check(
    "quote for a free stay",
    quote.status === 200 && quoteBody.free === true,
    JSON.stringify(quoteBody).slice(0, 80),
  );

  const bookingBody = {
    roomId: room.id,
    checkIn,
    checkOut,
    guestCount: 1,
    guestName: "E2E Guest",
    guestPhone: "+96171000001",
  };
  const first = await http(`/api/public/places/${place.slug}/bookings`, {
    method: "POST",
    body: JSON.stringify(bookingBody),
  });
  const firstBody = (await first.json()) as { reference: string; publicToken: string; status: string };
  check(
    "guest requests a stay -> 201 HELD",
    first.status === 201 && firstBody.status === "HELD",
    `status ${first.status}`,
  );
  const second = await http(`/api/public/places/${place.slug}/bookings`, {
    method: "POST",
    body: JSON.stringify({ ...bookingBody, guestPhone: "+96171000002" }),
  });
  check("same nights again -> 409 just taken", second.status === 409, `status ${second.status}`);
  const secondArabic = await http(`/api/public/places/${place.slug}/bookings`, {
    method: "POST",
    cookie: "locale=ar",
    body: JSON.stringify({ ...bookingBody, guestPhone: "+96171000003" }),
  });
  const arabicError = ((await secondArabic.json()) as { error?: { message?: string } }).error?.message ?? "";
  check("Arabic visitors get the error in Arabic", /[؀-ۿ]/.test(arabicError), arabicError);
  check("confirmation page by token", (await http(`/b/${firstBody.publicToken}`)).status === 200);
  check(
    "bad confirmation token shows not found",
    await isNotFound(await http("/b/not-a-real-token-at-all-000000")),
  );

  // ---------- Rate limit on public bookings (5 per address per hour) ----------
  let limited = false;
  for (let i = 0; i < 7 && !limited; i += 1) {
    const response = await http(`/api/public/places/${place.slug}/bookings`, {
      method: "POST",
      body: JSON.stringify({ ...bookingBody, guestPhone: `+9617100010${i}` }),
    });
    limited = response.status === 429;
  }
  check("public booking spam is rate limited (429)", limited);

  // ---------- Host flow ----------
  const hostCookie = await signIn("host@mabeet.test");
  const workspaces = (await (await http("/api/workspaces", { cookie: hostCookie })).json()) as Array<{
    businessId: string;
  }>;
  check(
    "host sees their workspaces",
    Array.isArray(workspaces) && workspaces.length > 0,
    `${workspaces.length}`,
  );
  const owns = workspaces.some((workspace) => workspace.businessId === place.id);
  const booking = await db.booking.findUniqueOrThrow({ where: { reference: firstBody.reference } });
  if (owns) {
    for (const page of [
      "",
      "/bookings",
      "/calendar",
      "/rooms",
      "/channels",
      "/reviews",
      "/team",
      "/keys",
      "/settings",
      "/assistant",
    ]) {
      const response = await http(`/dashboard/${place.id}${page}`, { cookie: hostCookie });
      check(
        `owner opens dashboard${page || " overview"}`,
        response.status === 200,
        `status ${response.status}`,
      );
    }
    const confirm = await http(`/api/workspaces/${place.id}/bookings/${booking.id}/confirm`, {
      method: "POST",
      cookie: hostCookie,
      body: "{}",
    });
    const confirmed = (await confirm.json()) as { status: string };
    check(
      "owner confirms the request",
      confirm.status === 200 && confirmed.status === "CONFIRMED",
      `status ${confirm.status}`,
    );
    const pay = await http(`/api/workspaces/${place.id}/bookings/${booking.id}/payments`, {
      method: "POST",
      cookie: hostCookie,
      body: JSON.stringify({ amountCents: booking.depositCents, method: "WHISH" }),
    });
    check("owner records a Whish deposit", pay.status === 201, `status ${pay.status}`);
    const report = await http(`/api/workspaces/${place.id}/analytics?from=${isoIn(-30)}&to=${isoIn(1)}`, {
      cookie: hostCookie,
    });
    check("analytics report", report.status === 200, `status ${report.status}`);
  } else {
    check("seeded host owns the first listed place", false, "skipped host dashboard checks");
  }

  // ---------- iCal export never leaks guest details ----------
  const ics = await http(`/api/ical/${room.exportToken}.ics`);
  const icsText = await ics.text();
  check(
    "iCal export works and hides guest names",
    ics.status === 200 && icsText.includes("BEGIN:VCALENDAR") && !icsText.includes("E2E Guest"),
  );

  // ---------- Isolation: a guest cannot reach the host's workspace ----------
  const guestCookie = await signIn("guest@mabeet.test");
  check(
    "guest -> host bookings API is 404",
    (await http(`/api/workspaces/${place.id}/bookings`, { cookie: guestCookie })).status === 404,
  );
  check(
    "guest -> host booking by id is 404",
    (await http(`/api/workspaces/${place.id}/bookings/${booking.id}`, { cookie: guestCookie })).status ===
      404,
  );
  check(
    "guest -> host dashboard page is 404",
    (await http(`/dashboard/${place.id}/settings`, { cookie: guestCookie })).status === 404,
  );
  check("guest -> /admin shows not found", await isNotFound(await http("/admin", { cookie: guestCookie })));
  check(
    "guest cannot suspend a business",
    (
      await http(`/api/admin/businesses/${place.id}`, {
        method: "PATCH",
        cookie: guestCookie,
        body: JSON.stringify({ status: "SUSPENDED" }),
      })
    ).status === 403,
  );
  check(
    "no session -> 401 on workspace API",
    (await http(`/api/workspaces/${place.id}/bookings`)).status === 401,
  );

  // ---------- Admin ----------
  const adminCookie = await signIn("admin@mabeet.test");
  check("admin opens /admin", (await http("/admin", { cookie: adminCookie })).status === 200);

  // ---------- Cron and MCP ----------
  check(
    "cron without secret -> 401",
    (await http("/api/cron/expire-holds", { method: "POST" })).status === 401,
  );
  check(
    "cron with secret -> 200",
    (
      await http("/api/cron/expire-holds", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    ).status === 200,
  );
  const mcp = await http("/api/mcp/guest", {
    method: "POST",
    headers: { accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const mcpText = await mcp.text();
  check(
    "guest MCP lists its tools",
    mcp.status === 200 && mcpText.includes("search_places"),
    `status ${mcp.status}`,
  );
  check(
    "host MCP without key -> 401",
    (
      await http("/api/mcp", {
        method: "POST",
        headers: { accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
    ).status === 401,
  );

  // ---------- An AI app connects over OAuth (discovery, registration, PKCE, workspace, consent) ----------
  await connectAiAppWithOAuth(hostCookie, place.id);

  // ---------- Experiences and services ----------
  for (const path of [
    "/?type=experiences",
    "/search?type=services",
    "/search?type=homes&tags=quiet&amenities=wifi&minPrice=50",
    "/search?type=experiences&category=food-wine",
  ]) {
    const response = await http(path);
    check(`GET ${path}`, response.status === 200, `status ${response.status}`);
  }
  const offering = await db.offering.findFirstOrThrow({
    where: { slug: "bekaa-cellar-wine-tasting-demo" },
    include: {
      sessions: {
        where: { startsAt: { gt: new Date() }, active: true },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
    },
  });
  const offeringPage = await (await http(`/o/${offering.slug}`)).text();
  check(
    "experience page shows Things to know and the map",
    offeringPage.includes("Things to know") && offeringPage.includes("maps.google.com"),
  );
  const sessionId = offering.sessions[0]!.id;
  const sessionRequest = await http(`/api/public/experiences/${offering.slug}/bookings`, {
    method: "POST",
    body: JSON.stringify({ sessionId, seats: 2, guestName: "E2E Guest", guestPhone: "+96171000009" }),
  });
  const sessionBody = (await sessionRequest.json()) as {
    publicToken: string;
    totalCents: number;
    status: string;
  };
  check(
    "guest books 2 seats in a session -> 201 HELD",
    sessionRequest.status === 201 && sessionBody.status === "HELD",
    `status ${sessionRequest.status}`,
  );
  check(
    "session price is per person (2 x $45)",
    sessionBody.totalCents === 9_000,
    String(sessionBody.totalCents),
  );
  check("session boarding pass page", (await http(`/b/${sessionBody.publicToken}`)).status === 200);
  const tooMany = await http(`/api/public/experiences/${offering.slug}/bookings`, {
    method: "POST",
    body: JSON.stringify({ sessionId, seats: 99, guestName: "E2E Guest", guestPhone: "+96171000010" }),
  });
  check("more guests than the group size is refused", tooMany.status === 400, `status ${tooMany.status}`);
  if (owns) {
    check(
      "owner opens Experiences & services",
      (await http(`/dashboard/${place.id}/offerings`, { cookie: hostCookie })).status === 200,
    );
    const sessionBooking = await db.sessionBooking.findUniqueOrThrow({
      where: { publicToken: sessionBody.publicToken },
    });
    const confirm = await http(
      `/api/workspaces/${sessionBooking.businessId}/session-bookings/${sessionBooking.id}/confirm`,
      {
        method: "POST",
        cookie: hostCookie,
        body: "{}",
      },
    );
    check("owner confirms the session booking", confirm.status === 200, `status ${confirm.status}`);
    check(
      "guest cannot confirm it",
      (
        await http(
          `/api/workspaces/${sessionBooking.businessId}/session-bookings/${sessionBooking.id}/confirm`,
          {
            method: "POST",
            cookie: guestCookie,
            body: "{}",
          },
        )
      ).status === 404,
    );
  }

  // ---------- Photo upload ----------
  if (owns) {
    // A real 1x1 JPEG, built in, so the test never depends on the internet.
    const jpeg = new Uint8Array(
      Buffer.from(
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
        "base64",
      ),
    );
    const upload = (bytes: Uint8Array<ArrayBuffer>, cookie: string, name = "room.jpg") => {
      const form = new FormData();
      form.set("file", new Blob([bytes]), name);
      return fetch(`${BASE}/api/workspaces/${place.id}/photos`, {
        method: "POST",
        body: form,
        headers: { cookie, origin: BASE },
      });
    };
    const uploaded = await upload(jpeg, hostCookie);
    const photo = (await uploaded.json()) as { id: string; url: string };
    check(
      "host uploads a JPEG",
      uploaded.status === 201 && photo.url.startsWith("/api/images/"),
      `status ${uploaded.status}`,
    );
    const served = await http(photo.url);
    check(
      "uploaded photo is served, cached forever",
      served.status === 200 &&
        served.headers.get("content-type") === "image/jpeg" &&
        (served.headers.get("cache-control") ?? "").includes("immutable"),
    );
    const fake = await upload(new TextEncoder().encode("not really an image"), hostCookie, "evil.jpg");
    check("a text file renamed .jpg is refused", fake.status === 400, `status ${fake.status}`);
    check("a guest cannot upload to this place", (await upload(jpeg, guestCookie)).status === 404);
    const cover = await http(`/api/workspaces/${place.id}/photos/${photo.id}`, {
      method: "PATCH",
      cookie: hostCookie,
      body: JSON.stringify({ cover: true }),
    });
    check("host makes it the cover", cover.status === 200, `status ${cover.status}`);
    const removed = await http(`/api/workspaces/${place.id}/photos/${photo.id}`, {
      method: "DELETE",
      cookie: hostCookie,
    });
    check(
      "host deletes it, bytes included",
      removed.status === 200 && (await http(photo.url)).status === 404,
    );
  }

  // Clean up only what this script created.
  await db.booking.deleteMany({ where: { guestName: "E2E Guest" } });
  await db.sessionBooking.deleteMany({ where: { guestName: "E2E Guest" } });
  await finish();
}

/** Plays an MCP client: finds the auth server, registers, signs the host in, picks a workspace, consents, calls MCP. */
async function connectAiAppWithOAuth(hostCookie: string, businessId: string) {
  const challenge =
    (await http("/api/mcp", { method: "POST", body: "{}" })).headers.get("www-authenticate") ?? "";
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
  check("MCP 401 points to its resource metadata", Boolean(metadataUrl), challenge);
  if (!metadataUrl) return;

  const resource = (await (await fetch(metadataUrl)).json()) as {
    resource: string;
    authorization_servers: string[];
  };
  const issuer = resource.authorization_servers[0] ?? "";
  const issuerPath = new URL(issuer).pathname.replace(/\/$/, "");
  const server = (await (await http(`/.well-known/oauth-authorization-server${issuerPath}`)).json()) as {
    registration_endpoint: string;
    authorization_endpoint: string;
    token_endpoint: string;
  };
  check("authorization server metadata", Boolean(server.registration_endpoint && server.token_endpoint));

  const redirectUri = "http://127.0.0.1:53682/callback";
  const registered = (await (
    await fetch(server.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Smoke AI app",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "mcp:read",
      }),
    })
  ).json()) as { client_id?: string };
  check("dynamic client registration", Boolean(registered.client_id));
  if (!registered.client_id) return;

  const { createHash, randomBytes } = await import("node:crypto");
  const verifier = randomBytes(32).toString("base64url");
  const authorize = new URL(server.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: registered.client_id,
    redirect_uri: redirectUri,
    scope: "mcp:read",
    state: "smoke",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: resource.resource,
  }).toString();
  const toPicker = await http(authorize.pathname + authorize.search, { cookie: hostCookie });
  // A browser gets a 302; a fetch with an Origin header gets the same address as JSON.
  const pickerTarget =
    toPicker.headers.get("location") ?? ((await toPicker.json().catch(() => ({}))) as { url?: string }).url;
  const pickerUrl = new URL(pickerTarget ?? "/", BASE);
  check("authorize asks which workspace", pickerUrl.pathname === "/oauth/workspace", pickerUrl.pathname);

  const picked = await http("/api/oauth/workspace", {
    method: "POST",
    cookie: hostCookie,
    body: JSON.stringify({ businessId }),
  });
  check("pick the workspace", picked.status === 200, `status ${picked.status}`);
  const continued = (await (
    await http("/api/auth/oauth2/continue", {
      method: "POST",
      cookie: hostCookie,
      body: JSON.stringify({ postLogin: true, oauth_query: pickerUrl.search.slice(1) }),
    })
  ).json()) as { url?: string };
  const consentUrl = new URL(continued.url ?? "/", BASE);
  check("then asks for consent", consentUrl.pathname === "/oauth/consent", consentUrl.pathname);
  check(
    "consent page renders",
    (await http(consentUrl.pathname + consentUrl.search, { cookie: hostCookie })).status === 200,
  );

  const consented = (await (
    await http("/api/auth/oauth2/consent", {
      method: "POST",
      cookie: hostCookie,
      body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
    })
  ).json()) as { url?: string };
  const code = consented.url ? new URL(consented.url).searchParams.get("code") : null;
  check("consent returns an authorization code", Boolean(code));
  if (!code) return;

  const token = (await (
    await fetch(server.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: registered.client_id,
        code_verifier: verifier,
        resource: resource.resource,
      }),
    })
  ).json()) as { access_token?: string };
  check("code + PKCE verifier -> access token", Boolean(token.access_token));
  if (!token.access_token) return;

  const tools = await http("/api/mcp", {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", authorization: `Bearer ${token.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const text = await tools.text();
  check(
    "host MCP works with the OAuth token",
    tools.status === 200 && text.includes("list_bookings"),
    `status ${tools.status}`,
  );
  check(
    "a read-only token gets no tools that change data",
    !text.includes("confirm_booking") && !text.includes("decline_booking"),
  );

  // Leave nothing behind: the client, its tokens and consents go with it (cascade).
  await db.oauthClient.deleteMany({ where: { clientId: registered.client_id } });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
