# Team plan

This file says who builds what, and when. It also says how we use GitHub.

Read it with the other files in this folder:

- `02-architecture-and-features.md`: how each feature works, and how the code is built.
- `03-claude-prompt-guide.md`: how to ask Claude for work.
- `04-test-plan.md`: which tests to write, and how.
- `05-project-structure.md`: where each file goes.

New words are explained in `README.md` (the glossary at the bottom).

---

## 1. Important dates

### Team meeting: Tuesday 27 October

We talked about the project together and changed the functional requirements (see
`06-functional-requirements.md`).

### Coding starts: Wednesday 28 October

Everyone starts today. In the morning, read parts 1 to 4 of the reading order (section 3). Then start your first
task. Finish the reading on Thursday.

### Call with Sami: Friday 30 October

We confirm with Sami what we build. This is called "locking the scope".

- We send the filled scope form to our Discord channel at least 3 hours before the call.
- After the call, adding a new feature needs Sami's approval.
- If Sami asks for a change, we update this plan on Friday afternoon.

### Checkpoint 1: Tuesday 3 November

The main flow works from start to end on the public website, in English and Arabic. It can still look plain.

The main flow: a guest picks dates, pays the full amount online (or sends a request, in offline mode), the room is
held, the owner confirms, and the guest sees the confirmation page. If a second guest asks for the same night, they
are refused.

### Checkpoint 2: Tuesday 10 November

Every "must have" feature is finished, and as many bonus features as possible (see
`06-functional-requirements.md`, Part A and Part B).

### Submission: Friday 13 November

No new features after 10 November. The last three days are only for fixing bugs, polishing, the documents and
recording the backup video.

### Every day: standup by 9:00 PM (Beirut time)

One message per team in our Discord channel. We take turns writing it.

```
Team:
Status: Green / Amber / Red
Done today:
Next:
Blocked on:
```

- Green: we are on time.
- Amber: we might be late. We could use help.
- Red: we will be late without help.

Saying Amber or Red early is good. It means help can come in time.

---

## 2. Who builds what

### One feature, one person

Each feature is built by **one person**, from start to end:

- the database queries,
- the business rules,
- the API routes,
- the screens,
- the text in every language,
- and the tests.

We all use Claude, and Claude can build a whole feature. So we never split one feature into a "backend person" and
a "frontend person". That only makes people wait for each other.

### Shared building blocks

Some parts have no screen. Other features use them. These are:

- the database schema (the list of tables),
- tenancy and permissions (who can do what in which business),
- the booking engine (the safe way to save a booking),
- the AI engine.

Each of these has one owner. Other people use them by calling their functions.

### Wouroud: the heavy backend features

Each one is built from start to end, with its own screens:

- GitHub, the checks on every pull request, and hosting on DigitalOcean with Docker (the website and the job worker)
- The database schema and migrations
- Queues and the worker: slow AI work, emails and scheduled jobs run outside the web request
- Tenancy and permissions
- The booking engine with the three modes
- Online payments and full automatic refunds (Whish and Stripe, confirmed by webhook)
- Calendar sync with Airbnb and Booking.com (with the channels screen)
- Payouts to owners (with the payout screens)
- The whole AI feature: the owner's assistant, the guest's assistant, and connecting Claude, Cursor or Codex
- Host plans and billing (bonus)

### Omar: the owner's daily work

Each one is built from start to end:

- Sign in, accounts, and creating a place
- Rooms and prices
- The owner's bookings screens, with Confirm, Decline and Cancel
- The calendar board and closed dates
- Team and roles
- The admin area (bonus)
- Experiences and services (bonus)

### Fatima: the guest's journey and the numbers

Each one is built from start to end:

- The design system and the app frame (the same look and themes as the reference project), with Back buttons
- English and Arabic, from the first day
- Everything the guest sees: search, the place page, the booking box, payment and the confirmation page
- Contact host and the host profile
- The settings screen, including choosing the booking mode
- What the guest receives: emails, and cancelling a booking
- Analytics and the commission saved (the number we show on stage)
- The notification bell
- Realistic Lebanese demo data
- The browser tests that prove the main flow always works
- Reviews and favourites, push notifications and installing the app (bonus)

### What everyone does

- Write the tests for your own features (see `04-test-plan.md`).
- Add every new text in all language files.
- Run the checks before you open a pull request.
- Read and comment on other people's pull requests.

### Two rules to work well together

**Rule A: database changes go through one person.**
If two people change the database at the same time, their changes clash. So all changes to `prisma/schema.prisma`
and `prisma/migrations/` go through Wouroud. If your feature needs a new column, write it in your pull request or
on Discord. It will come in a small pull request first.

**Rule B: every pull request is reviewed before it is merged.**
Wouroud reviews each one, and anyone can comment. A review checks the code against `02-architecture-and-features.md`.
It is not about personal taste.

---

## 3. Before we code: the meeting and the reading

### The meeting (Tuesday 27 October)

Talk about these topics in this order. The goal: each of us can explain each topic in our own words. Write every
decision and every open question in our Discord channel.

1. **The scope draft** (`docs/internal/scope-lock.md`). Who is the user? What is the problem? What is the main flow?
   What must work on stage? What do we cut? What number do we show? Fill the `[FILL]` parts together.
2. **What the app does** (`06-functional-requirements.md`). The three booking modes, what is a must have and what
   is a bonus.
3. **How well the app must work** (`docs/non-functional-requirements.md`). For example: no double bookings, one
   business never sees another's data, safe, fast on phones. Agree how we prove each one (a test, a database rule,
   or a review rule).
4. **The database** (`docs/erd.md`, and the changes in `07-data-model.md`). We keep every table, also for the bonus
   features.
5. **The API** (`docs/openapi.json`, and Part 4 of `02-architecture-and-features.md`). Which routes does the main
   flow need? Who owns each one?
6. **The architecture** (`docs/architecture.md`, `02-architecture-and-features.md`). The four layers, the booking
   race, calendar sync, and the AI.
7. **How we work** (sections 4 to 6 of this file).

### Reading order (Wednesday 28 and Thursday 29)

Read fully, in this order, and take notes. Read parts 1 to 4 on Wednesday morning, then start your first task.
Finish the rest on Thursday.

1. `docs/team/README.md` (5 minutes): what each file is for, and the glossary. Then
   `docs/team/06-functional-requirements.md` (30 minutes): what we build, and the three booking modes.
2. `docs/team/01-team-plan.md` (45 minutes): your tasks, the dates, and how we use GitHub.
3. `docs/team/02-architecture-and-features.md` (3 to 4 hours): the most important file. Read Parts 1 to 6 slowly.
   Then read the features you own in Part 7. Then read Part 13 (the checklist).
4. `docs/team/05-project-structure.md` (30 minutes): where each file goes.
5. `docs/team/08-design-system-and-pages.md` (1 hour): the design system, and the pages you own in Part 8.
6. `docs/team/04-test-plan.md` (1 hour): Part 2 (how to write tests) and the tests for your features.
7. `docs/team/03-claude-prompt-guide.md` (1 hour): the rules for Claude and the prompt template. Try writing a
   prompt for your first task.
8. `docs/team/07-data-model.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/requirements-matrix.md` (1 to
   2 hours).

### Questions to answer before the call with Sami

- What is in our scope, and what is cut?
- For each of your tasks: which files will you create? Which functions will you call? What does "done" mean?
- What do you need from someone else, and on which day is it ready? (See section 4.)
- What is not clear in the files? Ask now, in our Discord channel.

---

## 4. How nobody waits for anybody

The plan is made so that **nobody waits** for someone else to finish. And **nothing we write is temporary**: every
line merged into `main` is real, final code. We do not write "for now" versions to replace later.

Four rules make this work.

### Rule 1: the setup is ready first

Wouroud sets up the repository and the checks today (task W1), and the hosting right after. So everyone starts from
a working project, and a live website follows soon.

### Rule 2: the shared building blocks are built first, for real

Some parts are used by many features. They are built first, and they are final from the first day:

| Building block                                                                                                                       | Ready               | Who          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------ |
| The design basics (colours, `Button`, `Field`, `FormError`, `PageHeader`, `Panel`)                                                   | Thursday 29 October | Fatima (F1)  |
| The whole database schema (every table, including the bonus features), the permissions list and the demo data                        | Thursday 29 October | Wouroud (W2) |
| Tenancy: `TenantContext`, `tenantRoute` and the test helpers                                                                         | Friday 30 October   | Wouroud (W3) |
| The booking engine (`requestBooking`, `confirmBooking`, `declineBooking`, `cancelBooking`, `cancelStayAsGuest`) with the three modes | Saturday 31 October | Wouroud (W4) |
| Online payments and refunds (`startBookingCheckout`, the webhooks, `refundForEndedBooking`)                                          | Monday 2 November   | Wouroud (W5) |

### Rule 3: start with the parts that do not need anything else

Most of each feature does not need another person's work. Start there. For example:

- Fatima builds the place page, the booking box, prices and taken nights. They only read the database.
- Omar builds sign-in, rooms, and the bookings list and details. They read the demo data.

### Rule 4: connect the last step when the building block is merged

Each task below has two lines:

- **Uses:** which building blocks the task calls, and the day each one is ready.
- **Order:** which parts to build first, and which part to connect when a building block is merged.

For example, Fatima's "Book" button and Omar's Confirm and Decline buttons call the booking engine. The engine is
merged on Saturday 31 October, so they connect those buttons on Sunday 1 November. The pay buttons connect to the
online payments on Monday 2 November. That leaves Tuesday 3 November (Checkpoint 1) as a safety day.

### Contracts are written down, not coded

A **contract** is the agreed shape of a function: its name, what it takes in, and what it gives back. The contracts
of the building blocks are written in `02-architecture-and-features.md`. So everyone knows exactly how to call them
before they are merged. We never write fake or temporary versions of them.

### When something you use is late

- **Keep working on the parts that do not need it.** Every task has enough of them.
- **Never edit another person's files.** Ask on Discord, or write what you need in your pull request.
- **Only the owner changes a contract**, in a small pull request, announced on Discord.
- **Stuck for more than one hour?** Say it on Discord. **Stuck for one day?** Mark your standup Amber.

---

## 5. The tasks, person by person

"Due" means merged into `main`. Do the tasks in this order. Each task is one whole feature (or one shared building
block), built by one person from the database to the screen. The rules for booking and payment are in
`06-functional-requirements.md`, and the database changes are in `07-data-model.md`.

### Wouroud

#### W1. GitHub and hosting (due Wednesday 28 October)

Create the repository with the same setup as the reference project:

- Next.js 15 (App Router), TypeScript in strict mode, pnpm, the `@/` path shortcut.
- ESLint with the two layer rules, Prettier, knip, and Vitest with `unit` and `integration` tests.
- The empty folders from `05-project-structure.md`.
- The base files: `src/server/env.ts`, `src/server/errors.ts`, `src/server/db/client.ts`, `src/server/http/route.ts`.
- `scripts/local-db.ts` (a local database), `.env.example`, and `CLAUDE.md`.
- The CI file (the checks that run on every pull request) and protection on the `main` branch.
- The hosting on DigitalOcean with Docker: a `Dockerfile`, the database, the deploy step in GitHub Actions (only after
  every check passes), and the build that runs the database migrations. The same image runs twice: the website
  (`pnpm start`) and the worker (`pnpm worker`), both with `JOBS_MODE=queue` (see `docker-compose.yml`).

- **Uses:** nothing.
- **Done when:** a fresh copy runs with `pnpm install`, `pnpm db:start` and `pnpm dev` (website and worker); the checks pass on GitHub;
  a merge to `main` shows up on the public website; and the worker container is running beside it.

#### W2. The database, permissions and demo data (due Thursday 29 October)

- The whole `prisma/schema.prisma`, following `docs/erd.md` with the changes in `07-data-model.md`. Every table is
  included from the start, also for the bonus features (experiences, plans, AI, push).
- The migration with the database rule that refuses overlapping nights (`occupancy_no_overlap`).
- `src/server/auth/permissions.ts`: the list of permissions and the default roles. Omar needs it to create a place.
- The demo data: one guesthouse in each booking mode, an owner, a staff member, rooms, bookings in every status, one
  Airbnb stay and one closed date. Fatima makes it realistic later (F7).

- **Uses:** W1.
- **Done when:** `pnpm db:migrate` and `pnpm db:seed` work on an empty database.

#### W3. Tenancy (due Friday 30 October)

- `tenant-context.ts`: `TenantContext`, `can`, `requirePermission`, `requireOwner`.
- `team-service.resolveContext` and `tenantRoute` (the wrapper for every business route).
- `requirePageTenant` and `requirePageAccess` (the same check for pages).
- The test helpers `tests/integration/helpers.ts` and `http.ts`, which everyone uses in their tests.

- **Uses:** W2, and sign-in from Omar (O1, Thursday).
- **Done when:** a business route answers 404 to a non-member and works for a member, and a first
  `tenant-isolation.test.ts` passes.

#### W4. The booking engine with the three modes (due Saturday 31 October)

- `booking-policy.ts`: where a booking starts in each mode (automatic and online with approval start as
  `AWAITING_PAYMENT`; offline starts as `HELD`), the 10-minute payment window, and the owner's answer time.
- `booking-status.ts`: the allowed status changes in `07-data-model.md` (section 2.4).
- `pricing.ts`, `booking-repository.ts`, `constraint-errors.ts`.
- `booking-service.ts`: `requestBooking` (lock the room, expire old holds, refuse nights taken on Airbnb or
  Booking.com, save the booking and its nights together, turn the database's refusal into a 409), `confirmBooking`,
  `declineBooking`, `cancelBooking`, `cancelStayAsGuest`, `getBookingForGuest`, and the expiry job.

- **Uses:** W2, W3.
- **Done when:** `booking-flow.test.ts`, `booking-race.test.ts` and `occupancy-constraint.test.ts` pass, for all
  three modes.

#### W5. Online payments and full automatic refunds (due Monday 2 November, Checkpoint 1)

- The Whish client with its built-in simulator (a permanent mode that follows Whish's real API; switching to real
  Whish needs only the keys) and the Stripe client in test mode.
- `money-repository.ts` and `online-payment-service.ts`: `startBookingCheckout`, `settleOnlinePayment` (asks Whish or
  Stripe what happened; mode 1 confirms the booking, mode 2 moves it to "waiting for the owner"),
  `refundForEndedBooking` (always the full amount), and the job that cancels unpaid bookings after 10 minutes.
- The routes: checkout, the Whish callback and the Stripe webhook (each event applied only once).
- The **"Pay" buttons** on the guest's booking page (`pay-online.tsx`). Fatima owns that page; this pull request adds
  the buttons to it.

- **Uses:** W4.
- **Done when:** `money.test.ts` passes: a payment confirms a booking once even with 10 callbacks at once; an unpaid
  booking is cancelled after 10 minutes and its nights are free; every cancellation of a paid booking is refunded in
  full.

#### W6. Live data, queues and scheduled jobs (due Monday 2 November)

- Add the demo data to the live database, with a private `SEED_PASSWORD`.
- The queue core: `src/server/jobs/queue.ts` (`defineJob`, `runOrQueue`, `findJob`, the three queues `ai`, `notify`
  and `cron`), `registry.ts`, the worker `worker.ts`, and `GET /api/jobs/[jobId]`. pg-boss keeps the queues in our
  own PostgreSQL, in a `pgboss` schema.
- The scheduled jobs in `src/server/jobs/cron-jobs.ts`: calendar sync every 15 minutes, and housekeeping (expiry of
  unpaid and unanswered bookings) every 5 minutes, because of the 10-minute payment window. The worker runs them;
  `/api/cron/*` stay for a manual run.
- Try the main flow on two phones on the public website before Checkpoint 1.

- **Uses:** W1, W2.
- **Done when:** the public website shows the demo guesthouses, the worker log shows the scheduled jobs running, and
  `jobs.test.ts` passes.

#### W7. Calendar sync with Airbnb and Booking.com (due Thursday 5 November)

- `ical/safe-fetch.ts`, `parse-feed.ts`, `build-feed.ts`.
- The sync part of `calendar-repository.ts` and `calendar-service.ts`: `addFeed`, `removeFeed`, `syncFeed`,
  `syncFeedNow`, `getChannelSetup`, `refreshRoomFeeds`, `syncDueFeeds`, `buildRoomExport`.
- The routes: the feeds routes, `/api/ical/[token]` and `/api/cron/sync-feeds`.
- The **channels screen**: each room's export link with a copy button, a form to connect an Airbnb, Booking.com or
  other link, the last sync time and error, and a "Sync now" button.
- Imported nights only block the calendar. They are not bookings.

- **Uses:** W2 and W4. Airbnb nights then show on Omar's calendar board by themselves.
- **Done when:** `ical.test.ts` and the sync part of `calendar.test.ts` pass, and an owner connects a calendar link
  from a phone.

#### W8. Payouts to owners (due Saturday 7 November)

- `payout-service.ts`: what is held for each owner (online payments − refunds − payouts), and payout requests to a
  Whish number or a bank account (IBAN).
- The owner's **payouts page**, and the admin page that marks a payout as sent with its transfer reference.

- **Uses:** W5.
- **Done when:** an owner asks for a payout and an admin marks it sent; two requests at once cannot spend the same
  money.

#### W9. The whole AI feature (due Monday 9 November, bonus)

- **The engine:** `src/server/ai/tool.ts`, `run-tool.ts`, `deepseek.ts`, `assistant.ts` (with the fallback when
  the model fails), `team-tools.ts`, `guest-tools.ts`, and `ai-usage-service.ts` (the monthly budget).
- **The owner's assistant:** `assistant-service.ts`, `chat-service.ts`, the assistant routes, and the screens:
  `chat-panel.tsx`, `team-assistant.tsx`, `action-card.tsx` and the assistant page.
- **The guest's assistant:** `askConcierge` with place cards, `/api/assistant`, `/api/me/chats`, and `concierge.tsx`.
- **Connecting Claude, Cursor or Codex:** `mcp-server.ts`, `/api/mcp` and `/api/mcp/guest`, `mcp-token.ts`,
  `api-key-service.ts` and its routes, and the keys screen (`key-manager.tsx`).
- **Answer now, or queue:** `src/server/jobs/ai-jobs.ts` (the concierge, team assistant and report jobs, and the
  time estimates from the input size). The three AI routes call `runOrQueue`; the chat panel and the report page use
  `api.run`, which follows a queued job until it is done.

- **Uses:** other people's services, which are all merged by then.
- **Done when:** `assistant.test.ts`, `mcp-server.test.ts`, `ai-usage.test.ts`, `mcp-isolation.test.ts`,
  `assistant-actions.test.ts`, `chats.test.ts` and `jobs.test.ts` pass, and a long question is answered through the
  worker.

#### W10. Host plans and billing (due Tuesday 10 November, bonus)

Plans (Free, Pro, Business) with their limits; paying by Stripe subscription, by Whish, or by hand with a receipt
that an admin approves; the pricing page. Code: `billing-service.ts`, `plan-request-service.ts`.

- **Done when:** `billing.test.ts` and `plan-requests.test.ts` pass.

#### W11. Prove business isolation and roles (due Tuesday 10 November)

Finish `tenant-isolation.test.ts` for every area.

#### W12. Release work (Wednesday 11 to Friday 13 November)

Fix bugs, update the documents (`pnpm docs`), finish the README, and record the backup video with Fatima.

### Omar

#### O1. Sign in, accounts and creating a place (due Thursday 29 October)

- Better Auth: `src/server/auth/better-auth.ts`, the `/api/auth/[...all]` route, and `src/lib/auth-client.ts` with
  `signOutAndLeave`.
- The pages: sign in, sign up (with email verification) and forgot password in `src/app/(auth)/`, with
  `auth-form.tsx`, and the `SignOutButton`.
- `/home`: sends owners to their dashboard and guests to the home page.
- Creating a place: `onboarding-service.createWorkspace` (the business, the owner role and the default roles, all
  together), `POST /api/workspaces`, and the "Create your place" screen.

- **Uses:** W1, and the permissions list from W2 (Thursday).
- **Order:** sign in, sign up and sign out first. Creating a place once the permissions list is merged.
- **Done when:** a person signs up, creates a place, becomes its owner, signs out and signs in again, on a phone, in
  English and Arabic.

#### O2. Rooms and prices (due Saturday 31 October)

- `room-repository.ts`, `room-service.ts`, the input checks and the routes.
- The rooms pages with `room-editor.tsx` and `special-prices.tsx`.

- **Uses:** the database (W2, Thursday) and tenancy (W3, Friday).
- **Order:** the repository, the service and their tests first. The routes and pages after.
- **Done when:** `rooms.test.ts` passes, and an owner adds and edits rooms from a phone.

#### O3. The owner's bookings and decisions (due Monday 2 November, Checkpoint 1)

- `listBookings`, `getBooking`, `getBookingByReference`, with `presentForStaff` hiding guest contacts from staff who
  may not see them.
- The routes, including `POST .../bookings/[bookingId]/[action]`.
- The bookings list (waiting bookings first), each row shows the details and the countdown, and `booking-actions.tsx`
  (Confirm and Decline in modes 2 and 3, Cancel in every mode, each with an "are you sure?" step).
- The buttons call the booking engine: `confirmBooking`, `declineBooking`, `cancelBooking`.

- **Uses:** the demo bookings (W2), tenancy (W3), and the booking engine (W4, Saturday).
- **Order:** the list and its rows first. Connect the buttons on Sunday, after the engine is merged.
- **Done when:** `booking-actions.test.ts` passes, and an owner confirms, declines and cancels from a phone.

#### O4. The calendar board and closed dates (due Wednesday 4 November)

- `getCalendarBoard`, `addBlock`, `removeBlock` in `calendar-service.ts` and `calendar-repository.ts`, and their
  routes.
- The board: `calendar-board.tsx`, `calendar-side-panel.tsx`, `close-dates-form.tsx`, `calendar-model.ts`. Month
  view first, then week and rooms views. (No drag and drop.)

- **Uses:** the `Occupancy` table. The demo data has an Airbnb stay, so imported nights show even before W7.
- **Done when:** the blocks part of `calendar.test.ts` passes, and an owner closes and reopens dates from a phone.

#### O5. Team and roles (due Friday 6 November)

- Members and roles in `team-service.ts` and `team-repository.ts`, and their routes.
- The team page with `member-controls.tsx` and `role-editor.tsx`, and the switcher between businesses.

- **Uses:** W3.
- **Done when:** `roles.test.ts` passes.

#### O6. The admin area (due Monday 9 November, bonus)

Platform numbers, every host with their businesses, suspend or reactivate a business, open any business to help,
categories, the site's colour palette, calendar sync health and AI spending. Code: `admin-service.ts`,
`src/app/admin/**`. (Payouts and plan receipts in the admin area belong to W8 and W10.)

#### O7. Experiences and services (due Tuesday 10 November, bonus)

Experiences with sessions and seats, their page, and booking seats with the same three modes. Code:
`offering-service.ts`, `session-booking-service.ts`. The tables exist from W2.

#### O8. Release work (Wednesday 11 to Friday 13 November)

Fix bugs in your features. No new features.

### Fatima

#### F1. Design system, app frame and languages (basics Thursday 29 October, the rest Saturday 31 October)

We do **not** design a new look. The new project looks and works exactly like the reference project: the same
themes (five colour palettes, light and dark), the same colours, the same components and the same layouts. Nobody
chooses new colours, fonts or styles.

- By Thursday (everyone needs these): `globals.css` with every colour token, `Button` and `ButtonLink`, `Field`,
  `FormError`, `PageHeader` and `Panel`, `inputClass` and `panelClass`.
- By Saturday: `TextArea`, `LabeledControl`, `useConfirm`, `SheetDialog`, `Skeleton`, `LoadingStatus`,
  `choiceChipClass`, the app frame (side menu, top bar, phone tab bar, Back buttons), English, Arabic and Lebanese
  Arabic with next-intl, right-to-left for Arabic, and the light/dark switch.

- **Uses:** W1.
- **Done when:** a sample page works in light, dark, English and Arabic on a 390-pixel-wide screen, uses colour
  tokens only, and looks the same as the reference project.

#### F2. The guest's booking journey (due Monday 2 November, Checkpoint 1)

- `directory-repository.ts` and `directory-service.ts` (`getPlace`, `quoteRoom`, `getTakenNights`,
  `checkAvailability`).
- The public routes: the price quote, the taken nights, booking, and reading a booking by its secret link.
- A simple place page, `booking-widget.tsx`, the booking page with `guest-details-form.tsx`, and the booking page
  `/b/[token]` that shows the status and what to pay. (The full place page comes in F4.)
- The book route calls the booking engine's `requestBooking`.

- **Uses:** the design basics (F1), the demo data (W2), the booking engine (W4, Saturday), and the pay buttons (W5,
  Monday).
- **Order:** the place page, the booking box, the price quote and the taken nights first. Connect "Book" on Sunday,
  after the engine is merged.
- **Done when:** a guest books from start to end on a phone, a taken night cannot be chosen, and wrong input shows a
  calm message next to the field.

#### F3. Settings and choosing the booking mode (due Sunday 1 November)

- `settings-service.ts`, its route, and `settings-form.tsx`: contact, currency, commission rate, the owner's answer
  time, and **the booking mode** (automatic, online with approval, or offline).
- Choosing an online mode asks the owner to accept the payment policy ("online payments are always refunded in
  full") and saves `onlineTermsAcceptedAt`.

- **Uses:** W3.
- **Done when:** changing the mode changes how the next booking works.

#### F4. Search, the full place page, contact host and host profile (due Wednesday 4 November)

- Search with its filters (`searchPlaces`), and the home page that lists places (`place-card.tsx`).
- The full place page: photo tour, "Show all" popups, "Meet your host", reviews, map, sharing.
- Contact host (`contact-service.ts`, its route and page) and the host profile (`host-service.ts`, its page).

- **Done when:** a guest finds a place, reads its full page and contacts the host, on a phone, in English and
  Arabic.

#### F5. Analytics and the commission saved (due Friday 6 November)

- `analytics-repository.ts` (safe `$queryRaw`): nights sold, direct revenue, response time.
- `analytics-service.ts`: `getBusinessReport`, `getAnalytics` (one place or all places), `getSavings`.
- The analytics page and the dashboard overview (`stat-tile.tsx`, `bar-chart.tsx`): occupancy, direct revenue,
  response time, rating, and the **commission saved** (direct revenue × the owner's commission rate). Imported
  Airbnb and Booking.com nights are not counted as bookings.

- **Done when:** `analytics.test.ts` passes, and the overview shows direct bookings and commission saved on a phone.

#### F6. Emails, guest cancelling, and the notification bell (due Saturday 7 November)

- The guest's emails in `notification-service.ts` and `src/server/email/templates.ts`: booking received, paid,
  confirmed, declined, expired and cancelled, in the guest's language, each one a job on the `notify` queue
  (`defineJob`, from Wouroud's W6).
- The "Cancel my booking" button on the booking page and its route (`cancelStayAsGuest`, with a full refund when
  paid online).
- The notification bell (`notification-feed-service.ts`, `notification-bell.tsx`) and the full notifications page.

- **Done when:** `email.test.ts` and `guest-cancel.test.ts` pass, and the bell shows new bookings and payments.

#### F7. Realistic Lebanese demo data (due Sunday 8 November)

Lebanese guesthouse names and areas (Batroun, Deir el Qamar, Hamra, Jounieh, Ehden), rooms with USD prices, guests
with Lebanese names and `+961` numbers, months of past and future bookings, one Airbnb stay. No "(demo)", no
"test", no fake Latin text.

- **Done when:** `seed.test.ts` passes, and every screen looks like a real business.

#### F8. The demo works every time: browser tests and the phone check (due Tuesday 10 November)

- Set up Playwright (`playwright.config.ts` with a 390-pixel phone screen, `tests/e2e/`, `pnpm test:e2e`).
- Write `core-flow.spec.ts` (a guest books and pays, the owner confirms, the guest sees "confirmed") and
  `mobile-and-languages.spec.ts`.
- Loading screens, empty states and calm errors on every screen of your features.

- **Done when:** `pnpm test:e2e` passes, and nothing in the main flow scrolls sideways on a phone.

#### F9. Reviews, favourites, push notifications and installing the app (due Tuesday 10 November, bonus)

Reviews after check-out and favourites (`review-service.ts`, `favorite-service.ts`); push notifications
(`push-service.ts`) and installing the site as an app (manifest, icons, `public/sw.js`).

#### F10. Release work (Wednesday 11 to Friday 13 November)

Polish the demo screens, and record the backup video with Wouroud.

---

## 6. How we use GitHub

### Nobody pushes to `main` directly

Every change goes through a pull request. To merge, a pull request needs:

- all checks green,
- one approval,
- the branch up to date with `main`,
- every comment answered.

When a pull request is merged, the website updates by itself.

### One branch per task

Name: `<type>/<task-id>-<short-name>`. For example: `feat/W4-booking-engine`, `feat/F2-booking-widget`,
`fix/O3-confirm-button`.

Types:

- `feat`: something new
- `fix`: a bug fix
- `refactor`: same behaviour, cleaner code
- `test`: tests only
- `docs`: documents only
- `chore`: tools and setup

Always start from the latest `main`:

```
git switch main
git pull
git switch -c feat/F2-booking-widget
```

### Small pull requests, opened early

- One pull request does one thing.
- Keep it under about 400 changed lines.
- Split big tasks. For example, F2 can be three pull requests: the price route, the booking box, the confirmation
  page.
- Open a draft pull request after your first commit, so others can see what is coming.

### Commit messages

Write one simple sentence about what changed for the user. For example: "Guests see taken nights greyed out". Not:
"update picker".

### What to write in every pull request

```
## What this changes
One or two sentences, from the user's point of view.

## Task
W4 / O2 / F2 …

## How to check it
Steps to try it, and which demo account to use.

## Screenshots
Phone width (390 px), in English and Arabic, for any screen change.

## Checklist
- [ ] `pnpm check` passes on my computer
- [ ] The integration tests for this feature pass
- [ ] Every new text is in all language files
- [ ] Files are in the right folders (05-project-structure.md)
- [ ] No database change (or: it came in another pull request)
```

### Before you ask for a review

- Run `pnpm check` (types, lint, format, unused code, unit tests).
- Run the integration tests for your feature.
- A pull request with red checks is not reviewed.
- On a computer with little memory, stop `pnpm dev` before you run the checks.

### How reviews work

A pull request is reviewed within one working day. The review checks:

- the layers (route → service → repository),
- permissions are checked in the service,
- every input has a Zod check,
- no repeated code and no hand-typed value lists,
- colour tokens only,
- text in every language,
- the tests from `04-test-plan.md`.

Each comment is either:

- **must fix**: it blocks the merge, or
- **suggestion**: the author decides.

Answer every comment. Push your fixes as new commits. Then ask for a review again.

### Merging

- Use **Squash and merge**.
- Delete the branch after merging.
- If `main` changed, update your branch: `git pull --rebase origin main`. Fix conflicts. Run the checks again. Then
  push with `git push --force-with-lease`.

### Database changes

- Only Wouroud edits `prisma/schema.prisma` and creates migrations.
- If you need a new column, write it in your pull request or on Discord.
- Never edit a migration that is already merged. Add a new one.

### Files many people touch

These files change often: `src/server/validation/schemas.ts`, `messages/*.json`, `scripts/openapi.ts`.

- Add your lines in the part for your feature.
- Keep the existing order.
- Pull `main` every morning, so conflicts stay small.

### Never put secrets in the repository

- No keys, passwords or tokens in code, commits, screenshots or Discord.
- Your own secrets go in `.env` (git ignores it).
- Live secrets go in the DigitalOcean server's settings and in GitHub secrets.
- If a secret is pushed by mistake, tell Wouroud right away. It must be replaced, not just deleted.

---

## 7. A normal day

### Morning

- Pull `main` and update your branch.
- Read review comments.
- Pick your next task.

### During the day

- Work in small steps with Claude (see `03-claude-prompt-guide.md`).
- Run the checks before every push.
- If something blocks you for more than one hour, ask on Discord.

### Evening, by 9:00 PM

- Post the standup.
- Push your work to your branch, even if it is not finished, so nothing is lost.

---

## 8. If we are late

### Cut, never rush

If a checkpoint is at risk, cut the extras first. For example: the week and rooms views of the calendar, special
prices, Arabic polish. Never cut the main flow or its tests.

### Copy from the reference project

If a feature is still missing near 13 November, we can copy it from the reference project (Mabeet). It uses exactly
this structure, so it fits. The team decides together. The copied code still goes through a normal pull request and
review.
