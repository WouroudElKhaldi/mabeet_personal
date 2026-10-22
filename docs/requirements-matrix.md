# Requirements matrix

Each requirement, where it's written down, where it's built, and which test proves it. Paths are from the
repo root. "Smoke" and "edge cases" are `scripts/smoke.ts` and `scripts/edge-cases.ts`, run against a live app.

## The core guarantees

| Requirement                                 | Documented                                                                             | Implemented                                                                                                       | Tested                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| No two stays share a room night             | NFR, [architecture](architecture.md#no-double-bookings), data model                    | `occupancy_no_overlap` EXCLUDE constraint (`prisma/migrations/20261022000100_occupancy_no_overlap`)               | `tests/integration/occupancy-constraint.test.ts`: overlap refused, back-to-back allowed, inactive ignored     |
| Last free room: exactly one of many wins    | NFR, architecture                                                                      | `requestBooking`: room row lock + constraint (`src/server/services/booking-service.ts`)                           | `tests/integration/booking-race.test.ts`: 20 parallel requests → 1 booking, 19 `CONFLICT`, 1 active occupancy |
| Direct requests respect platform nights     | FR F10, architecture                                                                   | `assertNoImportedOverlap` under the room lock; feeds re-read before confirming                                    | `booking-flow.test.ts`: "blocks direct requests over nights imported from Airbnb or Booking.com"              |
| Last seats: never oversold                  | NFR, architecture                                                                      | `session_seats_guard` and `session_capacity_guard` triggers                                                       | `session-seats.test.ts`: 20 guests for 5 seats → exactly 5; hand-inserted row refused                         |
| Sane values in the database                 | Data model                                                                             | CHECK constraints: date ranges, guests > 0, rating 1–5, seats > 0, payment > 0, one target per payment            | `occupancy-constraint.test.ts` ("rejects an empty or reversed range", "sane values")                          |
| Business isolation over the website and API | NFR, [architecture](architecture.md#authentication-authorization-and-tenant-isolation) | `tenantRoute()` → membership → `TenantContext`; every repository query filters by `businessId`                    | `tenant-isolation.test.ts` over real HTTP: other workspace 404, smuggled ids 404, lists never mix             |
| Business isolation over MCP                 | NFR, architecture                                                                      | API key / OAuth token bound to one membership (`src/server/auth/mcp-token.ts`)                                    | `mcp-isolation.test.ts`: foreign reference not found, lists own rows only, revoked keys stop                  |
| Foreign ids look like "not found"           | Architecture                                                                           | Non-members get `404 Workspace`, foreign records `404`                                                            | `tenant-isolation.test.ts`, edge cases                                                                        |
| At least two roles                          | FR F13                                                                                 | Owner + owner-built roles from a fixed permission list (`src/server/auth/permissions.ts`); seeded Front desk role | `roles.test.ts` (13 cases), `permissions.test.ts`, `booking-flow.test.ts` (staff can't confirm)               |
| No privilege escalation                     | FR F13, NFR                                                                            | `team-service`: can't grant what you lack, can't change own access, only owners make owners                       | `roles.test.ts`                                                                                               |
| Read-only AI keys can't write               | FR F14, NFR                                                                            | `contextFrom(..., canWrite=false)` keeps only `*.read` permissions                                                | `roles.test.ts`, `mcp-isolation.test.ts` ("hides write tools from read-only keys")                            |
| Guest contacts only for allowed roles       | NFR (privacy)                                                                          | `presentForStaff` masks phone and email without `guests.contact`                                                  | `booking-flow.test.ts`, `privacy.test.ts`                                                                     |

## Calendars

| Requirement                                  | Documented                                                       | Implemented                                                                   | Tested                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| iCal import                                  | FR F10, [architecture](architecture.md#calendar-synchronization) | `syncFeed` (`calendar-service.ts`), `parse-feed.ts`                           | `ical.test.ts` (parsing); `calendar.test.ts`: imports, then drops events cancelled on the platform                  |
| No duplicate imports                         | Architecture                                                     | `@@unique([feedId, externalUid])`, upsert by UID                              | `calendar.test.ts`: a re-read stay keeps one row                                                                    |
| Platform clash flagged, never auto-cancelled | Architecture, README known limits                                | `flagImportConflicts`                                                         | `calendar.test.ts`: "flags a platform booking that collides with one of ours"                                       |
| Broken feed reported                         | Architecture                                                     | `recordFeedResult(lastError)`                                                 | `calendar.test.ts`: "records a broken feed's error for the owner to see"                                            |
| Scheduled refresh                            | Architecture (background jobs)                                   | `POST /api/cron/sync-feeds`, called by `.github/workflows/scheduled-jobs.yml` | Endpoint refuses a wrong secret (smoke, edge cases). The schedule itself is not tested automatically                |
| iCal export                                  | FR F10, architecture                                             | `GET /api/ical/{token}.ics` → `buildRoomExport`                               | `calendar.test.ts` (content, no guest details, no imported nights); smoke over HTTP; edge cases (unknown token 404) |
| Feed URLs can't reach private networks       | NFR (security)                                                   | `assertPublicHttpsUrl`, no redirects, 10 s timeout, 2 MB cap                  | `ical.test.ts` ("assertPublicHttpsUrl"); edge cases                                                                 |

## Booking lifecycle

| Requirement                                | Documented | Implemented                                              | Tested                                                                                       |
| ------------------------------------------ | ---------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Request holds the room at once             | FR F3      | `createHeldBooking` inserts DIRECT occupancy             | `booking-flow.test.ts`                                                                       |
| Allowed status changes only                | FR F9      | `assertTransition` (`booking-status.ts`)                 | `booking-status.test.ts`, `booking-flow.test.ts` ("never lets a finished booking come back") |
| Decline, cancel and expiry free the nights | FR F9      | `changeStatus` keeps `Occupancy.active` in step          | `booking-flow.test.ts`, `guest-cancel.test.ts`                                               |
| Unanswered holds expire                    | FR F9      | Per room on each request + `POST /api/cron/expire-holds` | `booking-flow.test.ts` ("expires a hold nobody answered"); smoke                             |
| Pricing and deposit                        | FR F7      | `quoteStay` (`pricing.ts`), rate overrides               | `pricing.test.ts`, `reviews-and-prices.test.ts`                                              |
| One review per stay, by the guest          | FR F5      | `review-service`, `review_one_booking` CHECK             | `reviews-and-prices.test.ts`                                                                 |

## Platform qualities

| Requirement                                 | Documented           | Implemented                                                                 | Tested                                                                                   |
| ------------------------------------------- | -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Validation on every route                   | NFR, architecture    | `route()` + `parseBody/parseQuery/parseParams` with `validation/schemas.ts` | `booking-flow.test.ts` (bad input); edge cases (bad input per route, field-level errors) |
| Routes → services → repositories            | README, architecture | ESLint `no-restricted-imports` rules (`eslint.config.mjs`)                  | `pnpm lint` in CI fails on a skipped layer                                               |
| Cross-site writes refused                   | NFR (security)       | `assertSameOrigin` in `route()`                                             | Edge cases                                                                               |
| Rate limits hold under load                 | NFR (security)       | Postgres-backed windows (`rate-limit-repository.ts`)                        | `rate-limit.test.ts`: 20 at once, exactly the limit passes                               |
| Email or push outage never breaks a booking | NFR (reliability)    | Notifications sent after commit, in the background, never throw             | Not tested automatically (see gaps)                                                      |
| Push only to real push services             | Architecture         | `isPushServiceUrl` in the subscribe schema                                  | `push.test.ts`                                                                           |
| Stripe webhooks verified and idempotent     | Architecture         | Signature check, `WebhookEvent` replay guard                                | `billing.test.ts`                                                                        |
| AI budget cap                               | NFR (cost)           | `ai-usage-service`                                                          | Not tested automatically (see gaps)                                                      |
| Three languages, complete                   | FR F18               | `messages/en.json`, `ar.json`, `ar-LB.json`                                 | `messages.test.ts`, `locale.test.ts`, `error-i18n.test.ts`                               |
| ERD matches the schema                      | README               | Generated by `pnpm docs:erd` from `prisma/schema.prisma`                    | CI fails if regenerating changes `docs/`                                                 |
| OpenAPI matches the routes                  | README               | Generated by `pnpm docs:openapi` from the same Zod schemas the routes use   | CI fails if regenerating changes `docs/`                                                 |

## Gaps, stated plainly

- **Scheduled jobs**: the cron endpoints are tested, but not that GitHub actually calls them on time. Correctness
  doesn't depend on it, because holds also expire per room on each request and feeds re-sync before confirming.
- **Notification failure isolation and the AI budget cap** are covered by code review only, not by automated
  tests.
- **Real Airbnb and Booking.com links**: import is tested with Airbnb-style iCal files, not against a live
  listing. Export has not been read by a real platform yet.
- **Push notifications and installing the app** have no automated test beyond the endpoint check above, and
  have not yet been tried on a real phone.
- **Smoke and failure-case runs** need a running app, so CI doesn't run them. They are run by hand before a
  release.
