/**
 * Writes docs/openapi.json (OpenAPI 3.1). Request bodies and queries come from the same Zod schemas the
 * routes validate with, so the contract cannot disagree with the code. Run: pnpm docs:openapi
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import * as s from "../src/server/validation/schemas";

type Auth = "public" | "session" | "member" | "key" | "cron" | "admin";

interface Operation {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  tag: string;
  auth: Auth;
  body?: z.ZodType;
  query?: z.ZodType;
  status?: number;
}

const OPERATIONS: Operation[] = [
  // Public guest flow
  {
    method: "get",
    path: "/api/public/places/{slug}/rooms/{roomId}/quote",
    summary: "Price and availability for a stay",
    tag: "Guests",
    auth: "public",
    query: s.stayDates,
  },
  {
    method: "get",
    path: "/api/public/places/{slug}/rooms/{roomId}/availability",
    summary: "Taken nights of a room (no guest details)",
    tag: "Guests",
    auth: "public",
    query: s.dateWindow,
  },
  {
    method: "post",
    path: "/api/public/places/{slug}/bookings",
    summary: "Request a stay: holds the room at once (rate limited)",
    tag: "Guests",
    auth: "public",
    body: s.bookingRequest,
    status: 201,
  },
  {
    method: "post",
    path: "/api/public/experiences/{slug}/bookings",
    summary: "Request seats in an experience or service session (rate limited)",
    tag: "Guests",
    auth: "public",
    body: s.sessionBookingRequest,
    status: 201,
  },
  {
    method: "get",
    path: "/api/public/bookings/{token}",
    summary: "A guest's booking by its secret link",
    tag: "Guests",
    auth: "public",
  },
  {
    method: "post",
    path: "/api/public/bookings/{token}/cancel",
    summary: "The guest cancels before check-in or before the session (rate limited)",
    tag: "Guests",
    auth: "public",
    body: z.object({ reason: z.string().max(300).optional() }),
  },
  {
    method: "get",
    path: "/api/me/bookings",
    summary: "The signed-in guest's stays",
    tag: "Guests",
    auth: "session",
  },
  {
    method: "post",
    path: "/api/me/reviews",
    summary: "Review a finished stay or experience (verified guests only)",
    tag: "Guests",
    auth: "session",
    body: s.reviewInput,
    status: 201,
  },
  {
    method: "get",
    path: "/api/me/export",
    summary: "Download everything held about the signed-in person (JSON)",
    tag: "Guests",
    auth: "session",
  },
  {
    method: "post",
    path: "/api/me/delete",
    summary: "Delete the signed-in account (repeat the email to confirm)",
    tag: "Guests",
    auth: "session",
    body: z.object({ email: z.string() }),
  },
  {
    method: "post",
    path: "/api/me/push",
    summary: "Turn on push notifications on this device for the signed-in person (rate limited)",
    tag: "Notifications",
    auth: "session",
    body: s.pushSubscribe,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/me/push",
    summary: "Turn off push notifications on this device",
    tag: "Notifications",
    auth: "session",
    body: s.pushUnsubscribe,
  },
  {
    method: "post",
    path: "/api/public/bookings/{token}/push",
    summary: "A guest without an account follows one booking on this device (rate limited)",
    tag: "Notifications",
    auth: "public",
    body: s.pushSubscribe,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/public/bookings/{token}/push",
    summary: "Stop following a booking on this device",
    tag: "Notifications",
    auth: "public",
    body: s.pushUnsubscribe,
  },
  {
    method: "post",
    path: "/api/assistant",
    summary: "Trip concierge chat (DeepSeek, read-only tools)",
    tag: "AI",
    auth: "public",
    body: s.chatInput,
  },
  {
    method: "get",
    path: "/api/ical/{token}",
    summary: "A room's availability as iCal, for Airbnb and Booking.com",
    tag: "Calendar",
    auth: "public",
  },
  // Workspaces
  {
    method: "get",
    path: "/api/workspaces",
    summary: "Workspaces the user belongs to",
    tag: "Workspaces",
    auth: "session",
  },
  {
    method: "post",
    path: "/api/workspaces",
    summary: "Create a business; the caller becomes its owner",
    tag: "Workspaces",
    auth: "session",
    body: s.workspaceInput,
    status: 201,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/settings",
    summary: "Business settings",
    tag: "Workspaces",
    auth: "member",
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/settings",
    summary: "Update business settings",
    tag: "Workspaces",
    auth: "member",
    body: s.settingsInput,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/analytics",
    summary: "Occupancy, revenue, commission saved, channels",
    tag: "Workspaces",
    auth: "member",
    query: s.dateWindow,
  },
  // Rooms and calendar
  {
    method: "get",
    path: "/api/workspaces/{businessId}/rooms",
    summary: "Rooms",
    tag: "Rooms",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/rooms",
    summary: "Create a room",
    tag: "Rooms",
    auth: "member",
    body: s.roomInput,
    status: 201,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/rooms/{roomId}",
    summary: "One room",
    tag: "Rooms",
    auth: "member",
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/rooms/{roomId}",
    summary: "Update a room",
    tag: "Rooms",
    auth: "member",
    body: s.roomUpdate,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/rooms/{roomId}/prices",
    summary: "Upcoming special prices, as runs of nights",
    tag: "Rooms",
    auth: "member",
  },
  {
    method: "put",
    path: "/api/workspaces/{businessId}/rooms/{roomId}/prices",
    summary: "Set a special price for a range of nights (null clears it)",
    tag: "Rooms",
    auth: "member",
    body: s.specialPriceInput,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/calendar",
    summary: "Taken nights from every source",
    tag: "Calendar",
    auth: "member",
    query: s.calendarQuery,
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/blocks",
    summary: "Close dates (maintenance, phone or Kazderni bookings)",
    tag: "Calendar",
    auth: "member",
    body: s.blockInput,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/blocks/{blockId}",
    summary: "Reopen dates",
    tag: "Calendar",
    auth: "member",
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/feeds",
    summary: "Export links and imported calendars per room",
    tag: "Calendar",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/feeds",
    summary: "Connect an Airbnb, Booking.com or Kazderni calendar",
    tag: "Calendar",
    auth: "member",
    body: s.feedInput,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/feeds/{feedId}",
    summary: "Disconnect a calendar",
    tag: "Calendar",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/feeds/{feedId}/sync",
    summary: "Sync a calendar now",
    tag: "Calendar",
    auth: "member",
  },
  // Bookings
  {
    method: "get",
    path: "/api/workspaces/{businessId}/bookings",
    summary: "Stays, filtered",
    tag: "Bookings",
    auth: "member",
    query: s.bookingFilters,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/bookings/{bookingId}",
    summary: "One stay",
    tag: "Bookings",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/bookings/{bookingId}/{action}",
    summary: "Confirm, decline or cancel a stay",
    tag: "Bookings",
    auth: "member",
    body: s.decision,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/bookings/{bookingId}/payments",
    summary: "Payments on a stay",
    tag: "Bookings",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/bookings/{bookingId}/payments",
    summary: "Record a deposit or payment",
    tag: "Bookings",
    auth: "member",
    body: s.paymentInput,
    status: 201,
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/session-bookings/{bookingId}/{action}",
    summary: "Confirm, decline or cancel a session booking",
    tag: "Bookings",
    auth: "member",
    body: s.decision,
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/session-bookings/{bookingId}/payments",
    summary: "Record a payment on a session booking",
    tag: "Bookings",
    auth: "member",
    body: s.paymentInput,
    status: 201,
  },
  // Experiences and services
  {
    method: "get",
    path: "/api/workspaces/{businessId}/offerings",
    summary: "Experiences and services",
    tag: "Experiences",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/offerings",
    summary: "Create an experience or service",
    tag: "Experiences",
    auth: "member",
    body: s.offeringInput,
    status: 201,
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/offerings/{offeringId}",
    summary: "Update an experience or service",
    tag: "Experiences",
    auth: "member",
    body: s.offeringUpdate,
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/offerings/{offeringId}/sessions",
    summary: "Schedule sessions on dates at one local time",
    tag: "Experiences",
    auth: "member",
    body: s.sessionsInput,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/sessions/{sessionId}",
    summary: "Cancel a session with nobody booked",
    tag: "Experiences",
    auth: "member",
  },
  // Photos
  {
    method: "post",
    path: "/api/workspaces/{businessId}/photos",
    summary: "Upload a photo (multipart: file, optional offeringId); JPEG, PNG or WebP up to 2.5 MB",
    tag: "Photos",
    auth: "member",
    status: 201,
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/photos/{photoId}",
    summary: "Make a photo the cover",
    tag: "Photos",
    auth: "member",
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/photos/{photoId}",
    summary: "Delete a photo and its stored bytes",
    tag: "Photos",
    auth: "member",
  },
  {
    method: "get",
    path: "/api/images/{imageId}",
    summary: "An uploaded photo, cached forever",
    tag: "Photos",
    auth: "public",
  },
  // Team
  {
    method: "get",
    path: "/api/workspaces/{businessId}/members",
    summary: "Team members",
    tag: "Team",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/members",
    summary: "Add a member with a role",
    tag: "Team",
    auth: "member",
    body: s.memberInput,
    status: 201,
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/members/{membershipId}",
    summary: "Change a member's role",
    tag: "Team",
    auth: "member",
    body: s.memberUpdate,
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/members/{membershipId}",
    summary: "Remove a member",
    tag: "Team",
    auth: "member",
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/roles",
    summary: "Custom roles",
    tag: "Team",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/roles",
    summary: "Create a role from permissions",
    tag: "Team",
    auth: "member",
    body: s.roleInput,
    status: 201,
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/roles/{roleId}",
    summary: "Edit a role",
    tag: "Team",
    auth: "member",
    body: s.roleInput.partial(),
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/roles/{roleId}",
    summary: "Delete an unused role",
    tag: "Team",
    auth: "member",
  },
  {
    method: "patch",
    path: "/api/workspaces/{businessId}/reviews/{reviewId}",
    summary: "Reply to or hide a review",
    tag: "Team",
    auth: "member",
    body: s.reviewUpdate,
  },
  // AI and keys
  {
    method: "post",
    path: "/api/workspaces/{businessId}/assistant",
    summary: "Team assistant chat, limited to the member's permissions",
    tag: "AI",
    auth: "member",
    body: s.chatInput,
  },
  {
    method: "get",
    path: "/api/workspaces/{businessId}/keys",
    summary: "The member's MCP keys",
    tag: "AI",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/keys",
    summary: "Create an MCP key (secret shown once)",
    tag: "AI",
    auth: "member",
    body: s.keyInput,
    status: 201,
  },
  {
    method: "delete",
    path: "/api/workspaces/{businessId}/keys/{keyId}",
    summary: "Revoke an MCP key",
    tag: "AI",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/mcp",
    summary: "Owner and staff MCP server (Streamable HTTP; API key or OAuth access token)",
    tag: "AI",
    auth: "key",
  },
  {
    method: "post",
    path: "/api/mcp/guest",
    summary: "Public guest MCP server, read-only (rate limited)",
    tag: "AI",
    auth: "public",
  },
  // Platform
  {
    method: "patch",
    path: "/api/admin/businesses/{businessId}",
    summary: "Suspend or reactivate a business",
    tag: "Platform",
    auth: "admin",
    body: s.businessStatusInput,
  },
  {
    method: "patch",
    path: "/api/admin/site",
    summary: "Set the website's colour palette",
    tag: "Platform",
    auth: "admin",
    body: s.siteSettingsInput,
  },
  {
    method: "get",
    path: "/api/admin/categories",
    summary: "Categories and their use",
    tag: "Platform",
    auth: "admin",
  },
  {
    method: "post",
    path: "/api/admin/categories",
    summary: "Add a browse category",
    tag: "Platform",
    auth: "admin",
    body: s.categoryInput,
    status: 201,
  },
  {
    method: "patch",
    path: "/api/admin/categories/{slug}",
    summary: "Rename, re-icon or reorder a category",
    tag: "Platform",
    auth: "admin",
    body: s.categoryUpdate,
  },
  {
    method: "delete",
    path: "/api/admin/categories/{slug}",
    summary: "Delete an unused category",
    tag: "Platform",
    auth: "admin",
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/billing/checkout",
    summary: "Start Stripe Checkout for a paid plan (owners)",
    tag: "Workspaces",
    auth: "member",
    body: s.checkoutInput,
  },
  {
    method: "post",
    path: "/api/workspaces/{businessId}/billing/portal",
    summary: "Open the Stripe billing portal (owners)",
    tag: "Workspaces",
    auth: "member",
  },
  {
    method: "post",
    path: "/api/webhooks/stripe",
    summary: "Stripe subscription events (signed; each event applied once)",
    tag: "Platform",
    auth: "public",
  },
  {
    method: "get",
    path: "/.well-known/oauth-protected-resource/api/mcp",
    summary: "How AI apps get a token for the host MCP server (RFC 9728)",
    tag: "Platform",
    auth: "public",
  },
  {
    method: "get",
    path: "/.well-known/oauth-authorization-server/api/auth",
    summary: "OAuth server metadata: registration, authorize and token endpoints (RFC 8414)",
    tag: "Platform",
    auth: "public",
  },
  {
    method: "post",
    path: "/api/oauth/workspace",
    summary: "Pick the workspace an AI app will act in, during OAuth",
    tag: "Platform",
    auth: "session",
    body: z.object({ businessId: z.string() }),
  },
  {
    method: "post",
    path: "/api/cron/sync-feeds",
    summary: "Sync calendars that are due",
    tag: "Platform",
    auth: "cron",
  },
  {
    method: "post",
    path: "/api/cron/expire-holds",
    summary: "Expire unanswered holds and email the guests",
    tag: "Platform",
    auth: "cron",
  },
];

const SECURITY: Record<Auth, Array<Record<string, string[]>>> = {
  public: [],
  session: [{ session: [] }],
  member: [{ session: [] }],
  admin: [{ session: [] }],
  key: [{ apiKey: [] }],
  cron: [{ cronSecret: [] }],
};

const AUTH_NOTE: Record<Auth, string> = {
  public: "No sign-in.",
  session: "Signed-in user.",
  member:
    "Signed-in member of the workspace; each call checks the member's permissions. Non-members get 404.",
  admin: "Super admin only.",
  key: "Bearer MCP key; tools are limited to the key owner's permissions.",
  cron: "Bearer CRON_SECRET.",
};

const schema = (type: z.ZodType) => z.toJSONSchema(type, { io: "input", unrepresentable: "any" });

const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
      required: ["code", "message"],
    },
  },
};

const paths: Record<string, Record<string, unknown>> = {};
for (const operation of OPERATIONS) {
  const pathParams = [...operation.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  const queryParams = operation.query
    ? Object.entries(
        (schema(operation.query) as { properties?: Record<string, unknown> }).properties ?? {},
      ).map(([name, property]) => ({ name, in: "query", schema: property }))
    : [];
  paths[operation.path] ??= {};
  paths[operation.path]![operation.method] = {
    tags: [operation.tag],
    summary: operation.summary,
    description: AUTH_NOTE[operation.auth],
    security: SECURITY[operation.auth],
    parameters: [...pathParams, ...queryParams],
    ...(operation.body && {
      requestBody: { required: true, content: { "application/json": { schema: schema(operation.body) } } },
    }),
    responses: {
      [operation.status ?? 200]: { description: "Success" },
      "400": { description: "Invalid input", content: { "application/json": { schema: error } } },
      "401": { description: "Sign-in or key required" },
      "403": { description: "Missing permission" },
      "404": { description: "Not found, or not yours" },
      "409": { description: "Conflict, e.g. dates or seats just taken" },
      "429": { description: "Rate limited" },
    },
  };
}

const document = {
  openapi: "3.1.0",
  info: {
    title: "Mabeet API",
    version: "1.0.0",
    description:
      "Direct bookings for Lebanese guesthouses, experiences and services. Every workspace route resolves the business from the URL and the caller's membership, never from the request body.",
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
      apiKey: { type: "http", scheme: "bearer", description: "MCP key, mbt_…" },
      cronSecret: { type: "http", scheme: "bearer", description: "CRON_SECRET" },
    },
  },
  paths,
};

writeFileSync("docs/openapi.json", `${JSON.stringify(document, null, 2)}\n`);
console.log(`docs/openapi.json: ${OPERATIONS.length} operations on ${Object.keys(paths).length} paths`);
