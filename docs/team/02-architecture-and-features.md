# Architecture and features

This file explains how the product works and how its code is built. It describes the reference project (Mabeet).

When you or Claude build a feature, build it the way this file says. If something is not here, ask Wouroud before
you invent a new way.

Each point has a short title and a full explanation. When there is a rule, the reason is given too. This helps you
use the rule in new cases.

New words are explained in `README.md` (the glossary).

---

## Part 1. The product

### What it is

A website where Lebanese guesthouses take bookings directly.

- Guests find a place, choose dates, and ask to book (or book at once).
- Guests pay a deposit to the host, or online.
- Hosts manage their rooms, one calendar, requests, payments and their team.
- The calendar stays in sync with Airbnb and Booking.com.
- Nobody pays a commission. The platform only earns money from host plans.

### The problem it solves

- Airbnb and Booking.com take 15 to 18 percent of every booking.
- Direct requests come on Instagram and WhatsApp. Hosts confirm them by hand.
- Sometimes a direct booking and an Airbnb booking land on the same night (a double booking).

Our product gives the host one booking page, one calendar, and a database that refuses double bookings.

### Who uses it

- **Guests:** browse, book, pay, cancel with a private link, and ask the guest's AI assistant.
- **Owners:** can do everything in their business, including money, settings and the team.
- **Staff:** can only do what their role allows. For example, "Front desk" handles bookings and closed dates, but
  cannot see money or settings.
- **Platform admins:** watch the whole platform, help any business, send payouts by hand, and can suspend a business.

### The main flow (what must work on stage)

1. A guest opens a place's booking link and picks dates. Nights already taken on Airbnb or Booking.com are greyed
   out.
2. The guest sends a request with their name and phone. The room is held for them right away.
3. A second guest asks for the same night. They are refused at once, because the database will not save two stays
   on one room night.
4. The owner gets the request. The app reads the Airbnb and Booking.com calendars again. The owner confirms.
5. The guest pays the deposit with Whish or a card. The money is held for the host. The night is now closed on
   Airbnb and Booking.com too, through our calendar link.
6. The owner asks the AI assistant to change something, or for a number. The owner confirms any change on a card.

---

## Part 2. The tools we use

### The tools, and why

- **Next.js 15 (App Router) with TypeScript in strict mode:** pages, the API, the calendar links and the MCP server,
  all in one project and one deploy.
- **PostgreSQL with Prisma 6:** the database, with typed queries and migrations. Postgres also gives us database
  rules that Prisma cannot write, such as the rule against overlapping nights. We write those rules by hand in SQL
  migration files.
- **Better Auth:** sign in with email and password, and sessions saved in the database. It also lets AI apps connect
  with OAuth (a safe sign-in for apps).
- **Zod 4:** checks every input: API input, AI tool input, settings in `.env`, and answers from DeepSeek, Stripe and
  Whish.
- **next-intl:** English, Arabic and Lebanese Arabic. Arabic is right-to-left.
- **Tailwind CSS 4:** styling, using design tokens only.
- **DeepSeek:** the AI model. Changing to another AI provider means changing one file.
- **Vitest:** unit tests (no database) and integration tests (real database).
- **Vercel and Neon:** hosting for the website (in Frankfurt) and for the database.
- **GitHub Actions:** runs the checks on every pull request, and deploys every merge to `main` that passes.

### The checks CI runs

- `pnpm typecheck`: no TypeScript errors.
- `pnpm lint`: ESLint, including the layer rules, type imports, no unused variables, and `===` instead of `==`.
- `pnpm format:check`: Prettier formatting (it also orders Tailwind classes).
- `pnpm knip`: no unused files, exports or packages.
- `pnpm test`: unit tests.
- `pnpm test:integration`: integration tests with a real database.
- The generated documents (`docs/erd.md`, `docs/openapi.json`) must match the code. CI fails if they are out of date.

---

## Part 3. The layers (the most important part)

### Four layers, one direction

```
routes and pages  →  services  →  repositories  →  database
(read the input,      (all rules,      (the only code that
 check it, answer)     permissions,     talks to the database)
                       transactions)
```

The website, the AI chat and the MCP server all call **the same services**. So a rule or a permission is written
**once** and works everywhere. This is the most important design choice. Never put a rule anywhere else.

### Routes and pages (`src/app/**`)

They do four things only:

1. Read the request.
2. Check the input with a Zod schema from `src/server/validation/schemas.ts`.
3. Call **one** service function.
4. Send the answer.

They have no business rules and never talk to the database. ESLint stops any import of `@/server/repositories/*` or
`@/server/db/*` from `src/app`.

### Services (`src/server/services/<area>-service.ts`)

They hold every rule:

- permission checks, for example `requirePermission(ctx, "bookings.decide")`,
- business rules, for example "the dates must be in the future" or "the room must fit the guests",
- transactions with `runInTransaction` (several database changes that succeed or fail together),
- notifications,
- the audit log with `recordAction` (a record of who did what).

Services are plain functions, grouped by area. When a service works inside a business, its first argument is a
`TenantContext`.

### Repositories (`src/server/repositories/<area>-repository.ts`)

The only code that runs database queries.

- The first argument is the database handle: `db: Db` for normal queries, or `tx: Tx` when the query must run
  inside a transaction.
- This way, a service can run several repository functions in one transaction.
- Every query on a business's data filters by `businessId`.
- Repositories make no decisions and check no permissions.

### The database (`prisma/schema.prisma`, `prisma/migrations/**`)

The last guard.

- The `occupancy_no_overlap` rule refuses overlapping nights.
- Triggers (automatic database checks) refuse selling more seats than a session has.
- CHECK rules keep values sensible (for example, check-out after check-in).

The database never trusts that the code is right.

### How a service uses the database

Services import `prisma` and `runInTransaction` from `src/server/db/client.ts` and pass them to repositories:

```ts
const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
await runInTransaction(async (tx) => {
  await lockActiveRoom(tx, ctx.businessId, roomId);
  await bookings.changeStatus(tx, ctx.businessId, bookingId, { status: "CONFIRMED" });
});
```

Only services import `prisma`. ESLint stops `@prisma/client` from being used outside repositories, except for types
(`import type`).

---

## Part 4. Requests, errors and input checks

### Every API route uses one wrapper

`src/server/http/route.ts` has two wrappers:

- `route(handler)` for public routes,
- `tenantRoute(paramsSchema, handler)` for business routes (`/api/workspaces/{businessId}/...`).

The wrapper:

- refuses writes that come from other websites,
- turns our errors into the right HTTP code,
- never shows internal errors. An unexpected error is logged, and the user sees "Something went wrong" (code 500).

```ts
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.userId}:${ctx.businessId}`, 15, 60_000);
  const input = await parseBody(request, chatInput);
  return json(await answerChat(scope, input, (history) => askTeamAssistant(ctx, history)));
});
```

### `tenantRoute` makes the business check impossible to forget

It does these steps before your code runs:

1. Reads the URL parts with the schema.
2. Checks the user is signed in (401 if not).
3. Checks the user is a member of the business in the URL, using `resolveContext`. If not, it answers 404 (not 403),
   so nobody can learn that a business exists.
4. Calls your handler with `{ request, ctx, params }`.

### Errors are objects with a code

`src/server/errors.ts` has `AppError(code, message, details?)` and helpers:

| Helper                 | HTTP code | Use it when                                |
| ---------------------- | --------- | ------------------------------------------ |
| `notFound("Room")`     | 404       | the thing does not exist (or is not yours) |
| `forbidden(message)`   | 403       | the user lacks a permission                |
| `conflict(message)`    | 409       | the action clashes with the current state  |
| `unauthenticated()`    | 401       | the user is not signed in                  |
| `invalid(message)`     | 400       | the input is wrong                         |
| `unavailable(message)` | 503       | a service (AI, payments) is not available  |

Services throw these. The wrapper turns them into answers. Write messages that people understand, for example
"Those dates were just taken. Please pick other dates." `localizeError` translates them.

### Database refusals become clear errors in one place

`src/server/services/constraint-errors.ts` wraps a database write:

- `overlapAsConflict(message, write)`: when the database refuses overlapping nights (Postgres code `23P01`), the
  user gets a 409 with your message.
- `duplicateAsConflict(message, write)`: the same, when a unique rule refuses a second copy (`P2002`).

Never write your own try/catch for these.

### Every input is checked with Zod

- All API input schemas are in `src/server/validation/schemas.ts`.
- Use `parseBody`, `parseQuery` and `parseParams`. Never read `request.json()` yourself.
- Wrong input gets a 400 answer with the wrong fields. The screen then highlights those fields.
- Reuse the small pieces at the top of the file: `id`, `isoDate`, `phone`, `cents`, `stayDates`, `dateWindow`.

### Lists of values live once, in `src/config/`

Statuses, payment methods, plans, report topics and listing kinds are lists in `src/config/enums.ts`, `plans.ts`
and `listing.ts`. Each list is checked against the database list with `satisfies`.

- Schemas use them: `z.enum(BOOKING_STATUSES)`.
- Screens loop over the same list.
- Types come from the list: `type PaidPlan = (typeof PAID_PLANS)[number]`.

Never type `"PRO" | "BUSINESS"` or `["HELD", "CONFIRMED"]` by hand.

### Limits on public and costly actions

`enforceRateLimit(key, limit, windowMs)` limits how often someone can do something (for example, 8 AI messages per
minute). It counts in the database, so it works across all servers.

- Public forms use the visitor's address: `clientAddress(request)`.
- Signed-in actions use the user and the business.

---

## Part 5. Sign in, businesses and permissions

### Three questions, in this order

1. **Who are you?**
   - On the website: a Better Auth session cookie.
   - For AI apps: a personal API key (`mbt_…`, we only store a hash of it) or an OAuth token.
   - For scheduled jobs: the `CRON_SECRET` key.
2. **Which business?** Always from the URL (`/api/workspaces/{businessId}/…`) or from the key or token. Then we check
   the user is a member. **Never** from the request body.
3. **Are you allowed?** The service checks a permission on the `TenantContext`.

### `TenantContext`: who, where, and with what rights

It is defined in `src/server/auth/tenant-context.ts`. It is built once per request and passed to every service:

- `resolveContext` builds it on the website,
- `resolveKeyContext` builds it for an API key,
- `resolveTokenContext` builds it for an OAuth token.

```ts
interface TenantContext {
  userId: string;
  businessId: string;
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
  channel: "web" | "mcp" | "chat";
  platformAdmin?: boolean;
  readOnly?: boolean;
}
```

Helpers:

- `can(ctx, permission)`: true or false.
- `requirePermission(ctx, permission)`: throws 403 if the permission is missing.
- `requireOwner(ctx, refusal)`: for things only an owner can do (money, plans, payouts).

### Permissions and roles

`src/server/auth/permissions.ts` lists the permissions: `rooms.read`, `rooms.manage`, `offerings.manage`,
`calendar.read`, `blocks.manage`, `feeds.manage`, `bookings.read`, `bookings.decide`, `guests.contact`,
`payments.record`, `reviews.reply`, `analytics.read`, `team.manage`, `roles.manage`, `settings.manage`, `ai.use`.

- Each business has an owner role (all permissions, cannot be changed).
- Each business also gets default roles (Manager, Front desk, Housekeeping), which it can change.
- Owners can make new roles by ticking permissions.
- Nobody can give a permission they do not have.
- A read-only AI key only keeps the "read" permissions.

### Staff without `guests.contact` see hidden contact details

`presentForStaff(ctx, booking)` hides the guest's phone and email (for example `+961 70 ••• •45`) for staff without
this permission. Every staff list or page of bookings uses it.

### Platform admins

A user with `platformRole = SUPER_ADMIN` can open any business's dashboard with all permissions. This only works on
the website, never through AI keys. Their actions are logged under their own name.

---

## Part 6. The database

### Every taken night is one row in `Occupancy`

Direct bookings, closed dates and Airbnb stays are all rows in `Occupancy`. Each row has:

- a `kind`: `DIRECT` (our booking), `MANUAL` (closed by the host) or `IMPORTED` (from Airbnb or Booking.com),
- a room,
- `checkIn` and `checkOut` (dates; the check-out night is free),
- an `active` flag,
- optional links: `bookingId`, or `feedId` with `externalUid` for imported stays.

Availability, the calendar, our calendar link and the overlap rule all read `Occupancy`, never `Booking`. A new
source of taken nights is a new `kind`, not new checks.

### `Booking` holds the guest's request and the money

A booking has:

- a `reference` like `SN-7KX3P9` (shown to people),
- a secret `publicToken` (the guest's private link),
- the guest's name, phone, email and note, and `guestCount`,
- `checkIn` and `checkOut`,
- `totalCents`, `depositCents`, `currency`,
- `onlineDueCents` (empty when the guest pays the host directly),
- `refundPolicy` (copied when the booking is made),
- `status` and `holdExpiresAt`,
- who decided, and when.

Its one `Occupancy` row takes the nights.

### `Business` holds the host's settings

- name, `slug` (the public web address), area, phone numbers,
- `timezone` (`Asia/Beirut`), `currency`,
- `commissionRateBps`: the commission a direct booking saves (1500 means 15 percent),
- `depositPercent`, `holdHours` (how long a request is held),
- `bookingMode`: `REQUEST` or `INSTANT`,
- `paymentCollection`: `AT_PLACE` (pay the host) or `ONLINE`,
- `onlineAmount`: `DEPOSIT` or `FULL`,
- `refundPolicy`, `bookingUnit` (`ROOMS` or `WHOLE_PLACE`), `listedPublicly`, `status`, `plan`.

### `Room`, `RateOverride`, `CalendarFeed`

- A **room** has a name, capacity, beds, `baseRateCents`, `minNights`, amenities, a secret `exportToken` (its
  calendar link), a `kind` (`ROOM`, or the one `WHOLE_PLACE` unit), and `active`.
- A **rate override** is a special price for one room on one date.
- A **calendar feed** is an Airbnb or Booking.com link for one room, with `lastSyncedAt` and `lastError`.

### `Role` and `Membership`

- A role belongs to one business and lists permission names.
- A membership links one user to one business, with one role and a status (`ACTIVE` or `REMOVED`).
- A user has at most one membership per business.

### Money tables: `Payment`, `Refund`, `Payout`, `PlanPayment`

- A payment belongs to a booking. It has an amount, currency, method, status, an `online` flag, and the payment
  provider's references.
- Refunds and payouts are separate rows.
- We never store a "balance". We calculate it: online payments − refunds − payouts.

### Log and AI tables

- `ActivityLog`: who did what to which thing. It also feeds the notification bell.
- `McpAuditLog`: every AI tool call (tool, result, time taken, channel).
- `AiUsage`: tokens and cost of each AI answer, for the monthly budget.
- `AiChat` and `AiChatMessage`: saved AI chats, per person.

### Rules for the schema

- Ids use `cuid()`.
- Money is always whole cents (`…Cents`), never decimals.
- Night dates use `@db.Date`.
- Every business table has a `businessId` and an index on it.
- Deleting a business deletes its data too.
- Enum values are in capital letters.

---

## Part 7. Features from A to Z

Each feature says what it does, where its code is, and the rules that matter.

### A. Guest account

Guests can sign up to see their stays (`/account`), save favourites, review a stay after check-out, download all
their data (`GET /api/me/export`), and delete their account (`POST /api/me/delete`, typing their email to confirm).
Code: `account-service.ts`, `src/app/(site)/account/**`.

### A. Activity log and notification bell

Every important action is recorded:

- `recordAction(ctx, action, entity, entityId)` for team actions,
- `logActivity` inside a transaction for guest actions.

The bell in the top bar shows the last five events of the business. "View all" opens the full list. Code:
`audit.ts`, `notification-feed-service.ts`, `notification-bell.tsx`.

### A. Admin area

`/admin`, for platform admins: businesses (suspend or reactivate), hosts, AI spending against the budget, calendar
sync health, payouts and refunds to send by hand, plan requests to approve, payment options, categories, and the
site's colour palette. Code: `admin-service.ts`, `src/app/admin/**`.

### A. AI: how it is built

The AI is another way into the same app, not a separate system.

- Every AI **tool** is a Zod input check plus a call to an existing service, with the caller's `TenantContext`.
- So the AI has exactly the same rights as the person behind it, and it can never see another business.
- Tools never take a `businessId`. The business always comes from the key, token or session.

The files:

- `src/server/ai/tool.ts`: the `AiTool` type (`name`, `description`, `input`, `requires` permission, `mutates`,
  `run(input, context)`).
- `run-tool.ts`: `createToolRunner(tools, context, onCall)` checks the input, runs the tool, turns errors into safe
  messages, measures the time, and reports the call to the audit log. `toolPayload` is what the model sees.
- `deepseek.ts`: `complete(messages, tools)` and `completeJson(messages, maxTokens)`, using one request function.
  Each tool's JSON description is built once and kept (cached).
- `assistant.ts`: `runAssistant` is the tool loop. The model can call tools up to 4 rounds, then it must answer.
  Tools in the same round run at the same time. With `proposeChanges`, tools that change data are **not** run. Their
  checked input comes back as a **proposal** for the person to confirm.
- `mcp-server.ts`: `handleMcpRequest` answers one MCP request. It only offers the tools the caller may use. It marks
  tools as "read only" or "changes data".

### A. AI: the owner's assistant (in the dashboard)

Page: `/dashboard/{id}/assistant`.

- It answers questions: free rooms, bookings, money, commission saved.
- It can carry out orders, such as "cancel booking SN-7KX3P9" or "close the Arched room from 12 to 15 November".
- It **never** acts on its own:
  1. The model asks for a tool that changes data.
  2. The input is checked against the tool's schema.
  3. The screen shows an `ActionCard` with the exact action and details (from the checked input, not from the
     model's words), and two buttons: **Confirm** and **Don't do it**.
  4. Confirm calls `POST /api/workspaces/{id}/assistant/actions`. This runs `runConfirmedAction`, which uses the same
     tool, checks and permissions as the dashboard buttons. The action is logged.
- Chats are saved for each person. A person can also start an unsaved chat, which is never stored.

Code: `assistant-service.ts`, `chat-service.ts`, `team-tools.ts`, `components/assistant/**`.

### A. AI: connecting Claude, Cursor or Codex (MCP)

Route: `POST /api/mcp`.

- The person connects with a personal API key (made on the "Connect AI" page, read-only or with write access, with
  an end date), or by signing in with OAuth and choosing a business.
- Read-only keys never see the tools that change data.
- Tools that change data are marked, so the AI app asks the person before running them.
- Every tool can take an optional `place`, to work in another of the person's businesses (`resolvePlaceContext`). It
  only allows places the person belongs to. If a name fits several places, it refuses.
- Every call is logged in `McpAuditLog`. The key's "last used" time is updated after the answer (`touchKey`).

### A. AI: the guest's assistant and guest MCP

- On the website: `/assistant`, `POST /api/assistant`.
- For AI apps: `POST /api/mcp/guest` (public).

Both use the read-only `GUEST_TOOLS`: search places, check availability, get a place, search experiences, get an
experience. They only see public data. They give a link to the booking page. They never book.

The place cards under a reply are built from the tool results, not from the model's words. So the model cannot
invent a place.

### A. AI: checks, limits and fallbacks

- **Input:** every tool input is checked by Zod before it runs. Wrong input returns a clear error to the model.
- **Permissions:** tools use the services' own permission checks. The list of tools is filtered by permission
  (`teamToolsFor(ctx)`).
- **Text from guests:** wrapped as `{ guestWritten: text }`. The instructions tell the model to treat it as data,
  never as orders. This protects against "prompt injection" (a guest writing orders to the AI).
- **Cost:** a monthly budget (`AI_MONTHLY_BUDGET_USD`, $50 by default).
  - `assertWithinBudget` checks it before each question.
  - `recordAiUsage` saves the cost after the answer, in the background.
  - Admins get one alert at 80 percent and one at 100 percent.
- **Speed:** limits per route, a 45-second time limit for the model, tools in the same round run together, and logs
  are written after the answer.
- **Fallback:** if the model is slow or fails, the person sees a clear message, and the rest of the app still works.

### A. AI report

On the analytics page, "Generate a report" sends the database's numbers for a period to the model. The answer is
checked against a schema (`reportShape`) before it is shown. The charts next to each section use the same numbers.
Only for Pro and Business plans. Code: `report-service.ts`, `report-generator.tsx`.

### A. Analytics and money saved on commission

Shows, for one place or all the owner's places:

- occupancy, nights sold, direct revenue, average price per night,
- **money saved on commission** = direct revenue × the business's commission rate,
- channels (direct, Airbnb, Booking.com…), requests by result, typical response time, rating.

Revenue is added up per currency, never mixed. All numbers come from the database through safe `$queryRaw` queries
in `analytics-repository.ts`. Code: `analytics-service.ts`, `dashboard/[businessId]/analytics/page.tsx`,
`analytics-charts.tsx`.

### B. Background work

`inBackground(label, work)` in `src/server/background.ts` runs side work **after** the answer is sent. Emails, push
notifications, AI logs, AI costs and "last used" times use it. If the work fails, it is logged. It never breaks the
request.

### B. Plans and billing

Free, Pro and Business plans (`src/config/plans.ts`), with limits on rooms, experiences, members and AI. Hosts pay
by card (Stripe subscription), by Whish (one month at a time), or by hand with a receipt that an admin approves. Plan
payments are the platform's only income. Code: `billing-service.ts`, `plan-request-service.ts`.

### B. Bookings: the statuses

| Status             | Meaning                                  |
| ------------------ | ---------------------------------------- |
| `HELD`             | A request waiting for the host           |
| `AWAITING_PAYMENT` | Accepted, waiting for the online payment |
| `CONFIRMED`        | Confirmed                                |
| `DECLINED`         | The host said no                         |
| `EXPIRED`          | Nobody answered or nobody paid in time   |
| `CANCELLED`        | Cancelled by the guest or the host       |

- The first three hold the nights (`ACTIVE_BOOKING_STATUSES`).
- The first two end when their time runs out (`EXPIRING_BOOKING_STATUSES`).
- Allowed changes are in `booking-status.ts` (`assertTransition`). Any other change gives a 409 error.

### B. Bookings: where a new booking starts

`booking-policy.ts` has simple functions with no database:

| Host's setting               | New booking starts as                          |
| ---------------------------- | ---------------------------------------------- |
| Request, guest pays the host | `HELD`                                         |
| Request, guest pays online   | `HELD`, then `AWAITING_PAYMENT` when accepted  |
| Instant, guest pays the host | `CONFIRMED`                                    |
| Instant, guest pays online   | `AWAITING_PAYMENT`, then `CONFIRMED` when paid |

`holdUntil` sets the deadline: the host's `holdHours` for a request, 30 minutes to pay an instant booking, and 24
hours to pay after the host accepts.

### B. Bookings: asking for a stay (safe against races)

A "race" is when two guests ask for the last room at the same moment. `requestBooking` in `booking-service.ts`
handles it:

1. Check the dates: at least 1 night, at most 60, not in the past, at most 540 days ahead.
2. Find the business by its slug (404 if none).
3. In one transaction:
   - lock the room row, so requests for one room take turns,
   - check the room fits (guests, minimum nights),
   - expire this room's old holds,
   - refuse nights already taken on Airbnb or Booking.com,
   - calculate the price,
   - save the booking and its `DIRECT` occupancy,
   - log the action.
4. If the database refuses the overlap, answer 409 "Those dates were just taken" (`overlapAsConflict`).
5. After saving, send the notifications in the background.

### B. Bookings: the host decides

- `confirmBooking` first reads the room's Airbnb and Booking.com calendars again (`refreshRoomFeeds`). Then it
  confirms (or moves to `AWAITING_PAYMENT` if the guest pays online).
- `declineBooking` and `cancelBooking` refund everything the guest paid online.
- All three lock the room, check the status change, keep the occupancy's `active` flag correct (`changeStatus`),
  save who decided and when, log the action and tell the guest.

### B. Bookings: the guest cancels

With their private link (`POST /api/public/bookings/{token}/cancel`), while the booking is held or confirmed, and
before check-in. The refund follows the booking's refund policy (`refundCents`).

### B. Bookings: holds that run out

- Each new request on a room expires that room's old holds.
- The scheduled job `/api/cron/expire-holds` expires the rest every 15 minutes.
- It uses one database update that checks the status again, so a hold confirmed a moment earlier is never touched.

### C. The calendar board

Page: `/dashboard/{id}/calendar`. Views: month, week and rooms.

- Colours by kind: our bookings, closed by the host, from a platform.
- Bookings waiting for an answer or payment have stripes.
- Clashes have a red outline.
- Click a day to see arrivals, departures, stays and free rooms.
- Click a stay to see its details.
- Double-click a day (or press "Close dates") to close nights.
- Drag closed dates to move them.

Code: `calendar-board.tsx` (views, selecting, drag and drop), `calendar-side-panel.tsx`, `close-dates-form.tsx`,
`calendar-model.ts` (types and date helpers).

### C. Closed dates (blocks)

`addBlock`, `moveBlock`, `removeBlock` in `calendar-service.ts`. A block is a `MANUAL` occupancy, so the database
refuses it on taken nights (409 "Those nights are already booked or blocked"). Hosts also use blocks for bookings
taken by phone or on Kazderni (which has no calendar link).

### C. Calendar sync: reading Airbnb and Booking.com

```
CalendarFeed (room, link, source)
  │  every 15 minutes · when the host presses "Sync now" · just before a host confirms
  ▼
download: https only, public addresses only, no redirects, 10-second limit, 2 MB limit   (ical/safe-fetch.ts)
  ▼
read: each event becomes [checkIn, checkOut) in the place's time zone;
      skip cancelled, past, more than 540 days ahead, and events with no id              (ical/parse-feed.ts)
  ▼
in one transaction, with the room locked:
  save IMPORTED occupancies by (feedId, externalUid)   reading again never makes copies
  turn off rows whose event disappeared                  a platform cancellation frees the nights
  mark clashes with our DIRECT or MANUAL rows
then save lastSyncedAt and lastError
```

- Imported rows are **not** under the overlap rule, because Airbnb and Booking.com can overlap each other. Direct
  requests are checked against them in code, with the room locked.
- Nothing is cancelled automatically. A clash is shown to the host.
- If a link fails, nothing already imported changes.

### C. Calendar sync: our calendar link

Each room shares `GET /api/ical/{exportToken}`:

- our `DIRECT` and `MANUAL` nights from today,
- the only text is "Not available" (no guest details),
- no imported nights (that would create loops),
- event ids never change (the platforms track events by id).

An unknown link answers 404.

### C. Categories

Browse categories (mountain, beach, hiking…) managed by admins, each for homes, experiences or services. A category's
slug and kind never change, because links use them.

### C. Contact the host

A guest can email a host from the place page (`POST /api/public/places/{slug}/messages`). It is rate limited. The
guest's email is the reply address. A host can turn it off and offer WhatsApp only.

### D. Dashboard overview

`/dashboard/{id}`: arrivals and departures today, waiting requests, upcoming bookings, the channels of the last 90
days, and the money saved. An owner with several places also sees them all together.

### D. Design system

The product looks and works exactly like the reference project:

- the same themes: five colour palettes (chosen by the platform admin), plus light and dark for each visitor,
- the same tokens, components, layouts and interactions.

New screens are built from these pieces. Nobody invents colours, fonts, spacing or new component styles.

- Every colour, corner radius, shadow and animation curve is a **token** in `src/app/globals.css`, shared with
  Tailwind through `@theme`.
- Components use token classes only: `bg-surface`, `text-muted`, `ring-line`, `bg-accent text-accent-ink`,
  `bg-danger text-danger-ink`, `backdrop:bg-scrim`. Never raw colours.
- The only fixed colours are other companies' brands (`brand-whatsapp`, `brand-airbnb`, `brand-booking`,
  `brand-messenger`, `brand-facebook`, `brand-x`), only for their logos.

Shared pieces:

- `Button` and `ButtonLink` (styles: primary, secondary, ghost, danger; sizes: sm, md, lg, icon),
- `Field`, `TextArea`, `LabeledControl`, `FormError`, `useConfirm`, `SheetDialog`, `Skeleton`, `PageHeader`, `Panel`,
- class names: `inputClass`, `panelClass`, `choiceChipClass`, `labelledControlClass`.

### E. Emails

- Resend sends the emails (`src/server/email/send.ts`).
- One HTML template (`templates.ts`). Guest text is made safe. Arabic is right-to-left.
- Each email is in the reader's language.
- Without an API key, emails are printed in the log.
- Addresses on reserved test domains (`.test`, `.example`, `.invalid`, `.localhost`) are never sent to, because they
  can never receive email. The demo accounts (`host@mabeet.test`) use them.
- Emails only reach other people's inboxes after the sending domain is verified on Resend.

### E. Experiences and services

Hosts can sell seats in dated sessions (a hike, a wine tasting, an airport transfer).

- The `session_seats_guard` trigger locks the session and refuses selling too many seats. If 20 guests race for the
  last 5 seats, exactly 5 get one.
- Same statuses, rules and payments as stays.

Code: `offering-service.ts`, `session-booking-service.ts`.

### F. Favourites

Signed-in guests can save places. Code: `favorite-service.ts`, `src/app/actions/favorites.ts`.

### H. Host profile

The owner's own profile (name, bio, languages, years hosting, how to contact). It shows on their listings only if
they choose. Code: `host-service.ts`.

### L. Languages

- `messages/en.json`, `ar.json` and `ar-LB.json` hold every text on screen.
- A unit test fails if a key is missing or empty in any file.
- Arabic pages are right-to-left.
- Server error messages are translated by `localizeError`.
- In components use `useTranslations("namespace")`. On the server use `getTranslations`.

### M. Money: guests paying online

1. `startBookingCheckout` creates a pending payment and returns the Whish or Stripe payment page.
2. When Whish calls us back, or the guest comes back, we only run `settleOnlinePayment`.
3. `settleOnlinePayment` asks Whish or Stripe what really happened. Their answer decides. So a fake callback cannot
   confirm a booking.
4. Marking a payment as paid happens only once, in a transaction. Calling it many times changes nothing.
5. If a payment arrives after the booking ended, it is refunded in full automatically.
6. A scheduled job checks payments still pending after 2 minutes.

### M. Money: refunds

`refundForEndedBooking(endedBooking, by, now)`:

- If the host or the platform ends the booking: full refund.
- If the guest cancels: the share in the refund policy (`FLEXIBLE`, `MODERATE`, `STRICT`, `NON_REFUNDABLE`).
- Card refunds go through Stripe for any amount.
- Whish only refunds whole payments. Partial Whish refunds show on the admin page to send by hand.

### M. Money: payouts to hosts

- Online money is held for the host.
- The owner sees how much is available and asks for a payout to a Whish number or a bank account (IBAN). Never card
  numbers.
- An admin sends it by hand from the platform's Whish or Stripe account, and marks it sent with the transfer
  reference.
- The business row is locked, so two requests cannot spend the same money.

### N. Notifications

- Hosts and staff who can decide bookings hear about new requests and guest cancellations.
- Guests hear about every status change.
- Each notification is an email and a push notification to every device the person turned on.
- Everything is sent in the background after saving, and never throws an error.

Code: `notification-service.ts`, `push-service.ts`.

### O. Creating a place

`POST /api/workspaces` creates a business with a unique slug (`uniqueSlug` in `src/lib/slug.ts`), its owner role
and default roles, and makes the user its owner. All in one transaction.

### P. Photos

JPEG, PNG or WebP, up to 2.5 MB. The file's own bytes decide its type, not its name. Photos are stored in the
database, served from `/api/images/{id}`, and cached forever. Code: `photo-service.ts`.

### P. Places and rooms (public)

`directory-service.ts` is the public side:

- `searchPlaces`: filters and dates. It uses two availability queries for all results together, never one per place.
- `getPlace`, `checkAvailability`, `quoteRoom`, `getTakenNights`.

The website search, the guest's AI and the guest MCP all use it, so they always agree.

### P. Pricing

`quoteStay` in `pricing.ts`:

- each night's price (the room's base price, or that night's special price),
- the total,
- the deposit (`depositPercent` of the total).

Money is always whole cents.

### P. Push notifications and installing the app

The site can be installed on a phone. It has a manifest, icons and a service worker (`public/sw.js`) that shows
notifications. We only accept push subscriptions from real browser push services. Pages are never served from the
cache, because availability must always be live.

### R. Reviews

Only a guest who stayed may review, only once, and only after check-out. Owners can reply or hide a review with a
reason. Code: `review-service.ts`.

### R. Rooms (dashboard)

Rooms with capacity, beds, base price, minimum nights, amenities, photos and special prices by date range. A place
can also be booked as a whole: one `WHOLE_PLACE` unit that takes turns with its rooms. Code: `room-service.ts`.

### S. Search and browse

The home page and `/search` list places, experiences and services with filters (area, dates, guests, price,
categories, amenities, accessibility). Filters come from the URL. Wrong filters are quietly ignored (`searchParams`
schema with `.catch`).

### S. Settings

Business settings: contact, currency, deposit percent, hold hours, commission rate, request or instant booking, how
guests pay, refund policy, and whether the place is listed. Needs `settings.manage`. Code: `settings-service.ts`,
`settings-form.tsx`.

### T. Team and roles

Add a member by email with a role, change their role, or remove them. Create, change and delete roles. Only an owner
can make or change an owner. Nobody can change their own access. Code: `team-service.ts`.

---

## Part 8. How to build screens

### Server components first

- Pages are server components. They read data through services, using `requirePageTenant` or `requirePageAccess`
  (from `src/server/http/session.ts`). These show the 404 page to non-members.
- Pages pass plain data to client components.
- Add `"use client"` only when a component needs state, effects or click handlers.

### Calling the API from the browser

- Use `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`, `api.upload` from `src/lib/api-client.ts`.
- If a call fails, it throws `ApiError` with the server's message.
- Show it with `errorMessage(caught, fallback)` and `FormError`.
- Never call `fetch` directly.

### Shared hooks

- `useAction()`: calls the API, then refreshes the page. Gives `pending` and `error`.
- `useRedirectAction(fallback)`: for steps that end on another page (Stripe, Whish, an AI app's sign-in).
- `useStoredChoice(key, allowed, fallback)`: remembers a choice in this browser, such as the calendar view.
- `useConfirm()`: the "are you sure?" dialog, before anything that cannot be undone.

### Loading, empty and error states

- Every dashboard page has a `loading.tsx`, built from `components/shell/skeletons.tsx`, in the shape of the real
  page.
- Every list has an empty state with one clear next step.
- Every action shows errors with `FormError`.

### Phones first

Every screen works at 390 pixels wide with no sideways scrolling. On phones, the dashboard has a tab bar at the
bottom.

### Accessibility

- A real label on every input.
- Visible focus rings.
- `role="alert"` on errors (`FormError` does this).
- Buttons for actions, never clickable `div`s.

---

## Part 9. Scheduled jobs

| Job           | Route                         | What it does                                                                                          | If it never runs                                                                              |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Calendar sync | `POST /api/cron/sync-feeds`   | Reads up to 20 calendar links not read in 15 minutes                                                  | Calendars still update on "Sync now" and before each confirmation                             |
| Housekeeping  | `POST /api/cron/expire-holds` | Checks pending online payments, expires unanswered and unpaid bookings, ends unpaid Whish plan months | Each new request expires its room's old holds; a returning guest's payment is checked at once |

Both need `Authorization: Bearer $CRON_SECRET`. `.github/workflows/scheduled-jobs.yml` calls them every 15 minutes,
once `APP_URL` and `CRON_SECRET` are set as GitHub secrets.

---

## Part 10. Security

- Writes from other websites are refused. Sign-in cookies are `SameSite`.
- Every input is checked. Every query filters by `businessId`. Non-members get 404.
- Calendar links are only downloaded from public https addresses, with no redirects and with size and time limits.
  This stops "SSRF" (tricking our server into calling private addresses).
- Uploaded files are checked by their bytes. Push subscriptions only for real push services.
- API keys are stored as hashes and shown only once. Read-only keys lose every write permission.
- Raw SQL only with safe `$queryRaw` templates (values are never pasted into the SQL text).
- Webhooks (calls from Stripe) are checked by signature and applied only once.
- No secrets in the repository. Live secrets are in Vercel and GitHub.

---

## Part 11. Settings in `.env`

`src/server/env.ts` checks them when the app starts.

**Required:**

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (at least 32 characters)
- `BETTER_AUTH_URL`
- `CRON_SECRET` (at least 24 characters)

**For tests:** `TEST_DATABASE_URL`.

**Optional (each one turns a feature on):**

- `DEEPSEEK_API_KEY`: the AI. `AI_MONTHLY_BUDGET_USD`: the AI budget.
- `RESEND_API_KEY` and `EMAIL_FROM`: emails.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`: card payments.
- `WHISH_MODE` (`simulator` by default), `WHISH_CHANNEL`, `WHISH_SECRET`, `WHISH_WEBSITE_URL`: real Whish.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: push notifications.

`.env.example` lists them all, empty.

---

## Part 12. Documents the brief asks for

- `README.md`: setup, architecture, key decisions, known limits.
- `docs/functional-requirements.md` and `docs/non-functional-requirements.md`.
- `docs/erd.md`: the database diagram, made from `prisma/schema.prisma` by `pnpm docs:erd`.
- `docs/openapi.json`: the API contract, made from the same Zod schemas the routes use, by `pnpm docs:openapi`. A test
  fails if a route is missing from it.
- `docs/architecture.md` and `docs/requirements-matrix.md` (each requirement, where it is built, and which test
  proves it).

---

## Part 13. Checklist for any new code

1. Is the rule in a service, the query in a repository, and the route short?
2. Does the service check the permission and filter by `ctx.businessId`?
3. Is every input checked by a schema in `schemas.ts`?
4. Do lists of values come from `src/config/`, not typed by hand?
5. Are database refusals handled with `overlapAsConflict` or `duplicateAsConflict`?
6. Is side work (email, push, logs) inside `inBackground`?
7. Does the screen use tokens and `components/ui/`, with loading, empty and error states, at phone width?
8. Is every new text in all language files?
9. Are the tests from `04-test-plan.md` written and passing?
10. Does `pnpm check` pass? Is a new route added to `scripts/openapi.ts` (then run `pnpm docs`)?

---

## Part 14. Contracts of the shared building blocks

A contract is the exact way to call a function: its name, what it takes in, and what it gives back. These are the
functions other features call. They do not change without a pull request announced on Discord. Build your feature
against these exact shapes, even before the function is merged.

### The booking engine (`src/server/services/booking-service.ts`, Wouroud, merged Monday 2 November)

```ts
interface BookingRequest {
  businessSlug: string;     // the place's public slug
  roomId: string;
  range: DateRange;          // { checkIn, checkOut }, check-out night free
  guestCount: number;
  guestName: string;
  guestPhone: string;        // international format, +961...
  guestEmail: string | null;
  guestNote: string | null;
  guestUserId: string | null; // the signed-in guest, if any
  locale?: string;           // the guest's language, for their emails
}

interface Decision {
  bookingId: string;
  reason?: string;
}

requestBooking(request: BookingRequest, now?: Date): Promise<Booking>
// Holds the room at once. Throws conflict (409) "Those dates were just taken" if the nights are taken.

confirmBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
declineBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
cancelBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
// Need bookings.decide. Throw conflict (409) for a status change that is not allowed.

cancelStayAsGuest(publicToken: string, reason: string | null, now?: Date): Promise<Booking | null>
// The guest's private link. Returns null for an unknown link. Throws conflict (409) once the stay has started.

getBookingForGuest(publicToken: string): Promise<(Booking & { room; business; payments }) | null>
```

### Tenancy (`src/server/auth/tenant-context.ts`, `src/server/http/*`, Wouroud, merged Sunday 1 November)

```ts
can(ctx: TenantContext, permission: Permission): boolean
requirePermission(ctx: TenantContext, permission: Permission): void   // throws forbidden (403)
requireOwner(ctx: TenantContext, refusal: string): void               // throws forbidden (403)

tenantRoute(paramsSchema, handler: ({ request, ctx, params }) => Promise<Response>)
// For /api/workspaces/[businessId]/**: 401 if not signed in, 404 if not a member.

requirePageTenant(businessId: string): Promise<TenantContext>          // pages: 404 page if not a member
requirePageAccess(businessId: string, anyOf: Permission[]): Promise<TenantContext>
```

### Permissions and roles (`src/server/auth/permissions.ts`, Wouroud, merged Saturday 31 October)

```ts
type Permission = "rooms.read" | "rooms.manage" | ... | "ai.use"   // the full list is in Part 5
ALL_PERMISSIONS: Permission[]
DEFAULT_ROLE_TEMPLATES   // the default roles (Manager, Front desk, Housekeeping), added when a place is created
// The owner role is made separately when a place is created: it has every permission and cannot be changed.
```
