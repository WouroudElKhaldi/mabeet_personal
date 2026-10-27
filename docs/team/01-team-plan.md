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

We meet to talk about the project together. If we do not finish, we continue on Wednesday 28.

### Reading: Wednesday 28 October, during the day

Omar and Fatima read all the files in this folder. Take notes. Write down your questions. Reading comes first:
coding before understanding the structure costs more time than it saves.

### Early coding: Wednesday 28 (evening) and Thursday 29 October

We start coding early, but **only work that is the same whatever Sami decides** (we call it "scope-proof"). Every
version of this project needs it. This gives Checkpoint 1 a safety margin.

| Who     | Scope-proof work                                                                                                        | Why it is safe                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Wouroud | GitHub and hosting setup (W1), the core tables and permissions (W2, part 1), tenancy (W3), then the booking engine (W4) | The brief requires many businesses, roles and the double-booking rule |
| Omar    | Sign in, sign up and sign out (O1, part 1)                                                                              | Every version needs sign-in and two roles                             |
| Fatima  | The design basics (F1, part 1)                                                                                          | The look is fixed: the same themes as the reference project           |

Not before the call: tables for features that might be cut, the demo data, the AI, payments, analytics, or any
change to the main flow.

### Call with Sami: Friday 30 October

We agree with Sami on what we will build. This is called "locking the scope".

- We send the filled scope form to our Discord channel at least 3 hours before the call.
- After the call, adding a new feature needs Sami's approval.
- We do not build anything that depends on the scope before this call, because the call can change it.
- On Friday afternoon, we update this plan to match what we agreed.

### Full coding: Saturday 31 October

Everything else starts, following the scope we agreed with Sami.

### Checkpoint 1: Tuesday 3 November

The main flow works from start to end on the public website. It can still look plain.

The main flow is: a guest asks for dates, the room is held for them, the owner confirms, and the guest sees the
confirmation page. If a second guest asks for the same night, they are refused.

### Checkpoint 2: Tuesday 10 November

All features are finished. This includes calendar sync, the deposit, the AI, realistic data and the tests.

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

- GitHub, the checks on every pull request, and hosting
- The database schema and migrations
- Tenancy and permissions
- The booking engine
- Calendar sync with Airbnb and Booking.com (with the channels screen)
- Online deposits and payouts (with the pay buttons and the payout screens)
- The whole AI feature: the owner's assistant, the guest's assistant, and connecting Claude, Cursor or Codex

### Omar: the owner's daily work

Each one is built from start to end:

- Sign in, accounts, and creating a place
- Rooms and prices
- The owner's bookings screens, with Confirm, Decline and Cancel
- The calendar board and closed dates
- Team and roles

### Fatima: the guest's journey and the numbers

Each one is built from start to end:

- The design system and the app frame (the same look and themes as the reference project)
- English and Arabic
- Everything the guest sees: the place page, the booking box, the request form and the confirmation page
- What the guest receives: emails, and cancelling a booking
- Analytics and the money saved on commission (the number we show on stage)
- The settings screen
- Realistic Lebanese demo data
- The browser tests that prove the main flow always works

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

### The meeting (Tuesday 27, and Wednesday 28 morning if needed)

Talk about these topics in this order. The goal: each of us can explain each topic in our own words. Write every
decision and every open question in our Discord channel.

1. **The scope draft** (`docs/internal/scope-lock.md`). Who is the user? What is the problem? What is the main flow?
   What must work on stage? What do we cut? What number do we show? Fill the `[FILL]` parts together.
2. **What the app does** (`docs/functional-requirements.md`). Mark what is in our scope and what is cut.
3. **How well the app must work** (`docs/non-functional-requirements.md`). For example: no double bookings, one
   business never sees another's data, safe, fast on phones. Agree how we prove each one (a test, a database rule,
   or a review rule).
4. **The database** (`docs/data-model.md`, `docs/erd.md`). Which tables do we keep? Which do we drop because the
   feature is cut?
5. **The API** (`docs/openapi.json`, and Part 4 of `02-architecture-and-features.md`). Which routes does the main
   flow need? Who owns each one?
6. **The architecture** (`docs/architecture.md`, `02-architecture-and-features.md`). The four layers, the booking
   race, calendar sync, and the AI.
7. **How we work** (sections 4 to 6 of this file).

### Reading order (Wednesday 28, during the day)

Read fully, in this order, and take notes. Read parts 1 to 4 on Wednesday before you start coding in the evening.
Finish the rest on Thursday.

1. `docs/team/README.md` (5 minutes): what each file is for, and the glossary.
2. `docs/team/01-team-plan.md` (45 minutes): your tasks, the dates, and how we use GitHub.
3. `docs/team/02-architecture-and-features.md` (3 to 4 hours): the most important file. Read Parts 1 to 6 slowly.
   Then read the features you own in Part 7. Then read Part 13 (the checklist).
4. `docs/team/05-project-structure.md` (30 minutes): where each file goes.
5. `docs/team/04-test-plan.md` (1 hour): Part 2 (how to write tests) and the tests for your features.
6. `docs/team/03-claude-prompt-guide.md` (1 hour): the rules for Claude and the prompt template. Try writing a
   prompt for your first task.
7. `docs/architecture.md`, `docs/data-model.md`, `docs/requirements-matrix.md` (1 to 2 hours).

### Questions to answer before the call with Sami

- What is in our scope, and what is cut?
- For each of your tasks: which files will you create? Which functions will you call? What does "done" mean?
- What do you need from someone else, and on which day is it ready? (See section 4.)
- What is not clear in the files? Ask now, not on Saturday.

---

## 4. How nobody waits for anybody

The plan is made so that **nobody waits** for someone else to finish. And **nothing we write is temporary**: every
line merged into `main` is real, final code. We do not write "for now" versions to replace later.

Four rules make this work.

### Rule 1: the setup is ready before we start

Wouroud sets up the repository and the checks on Wednesday (task W1), and the hosting by Thursday. So on Wednesday
evening, everyone gets a working project, and by Thursday a live website.

### Rule 2: the shared building blocks are built first, for real

Some parts are used by many features. They are built first, and they are final from the first day:

| Building block                                                                                                  | Ready               | Who          |
| --------------------------------------------------------------------------------------------------------------- | ------------------- | ------------ |
| The design basics (colours, `Button`, `Field`, `FormError`, `PageHeader`, `Panel`)                              | Thursday 29 October | Fatima (F1)  |
| The core tables, and the list of permissions and roles                                                          | Thursday 29 October | Wouroud (W2) |
| Tenancy: `TenantContext`, `tenantRoute` and the test helpers                                                    | Friday 30 October   | Wouroud (W3) |
| The rest of the tables (after the call) and the demo data                                                       | Saturday 31 October | Wouroud (W2) |
| The booking engine (`requestBooking`, `confirmBooking`, `declineBooking`, `cancelBooking`, `cancelStayAsGuest`) | Sunday 1 November   | Wouroud (W4) |

### Rule 3: start with the parts that do not need anything else

Most of each feature does not need another person's work. Start there. For example:

- Fatima builds the place page, the booking box, prices and taken nights. They only read the database.
- Omar builds sign-in, rooms, and the bookings list and details. They read the demo data.

### Rule 4: connect the last step when the building block is merged

Each task below has two lines:

- **Uses:** which building blocks the task calls, and the day each one is ready.
- **Order:** which parts to build first, and which part to connect when a building block is merged.

For example, Fatima's "Send request" button and Omar's Confirm and Decline buttons call the booking engine. The
engine is merged on Sunday 1 November, so they connect those buttons on Monday 2 November. That leaves Tuesday 3
November (Checkpoint 1) as a safety day. Everything else in their tasks is built before that.

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
block), built by one person from the database to the screen.

### Wouroud

#### W1. GitHub and hosting setup (repository Wednesday 28 October, hosting Thursday 29 October)

Create the repository with the same setup as the reference project:

- Next.js 15 (App Router), TypeScript in strict mode, pnpm, the `@/` path shortcut.
- ESLint with the two layer rules, Prettier, knip, and Vitest with `unit` and `integration` tests.
- The empty folders from `05-project-structure.md`.
- The base files: `src/server/env.ts`, `src/server/errors.ts`, `src/server/db/client.ts`, `src/server/http/route.ts`.
- `scripts/local-db.ts` (a local database), `.env.example`, and `CLAUDE.md`.
- The CI file (the checks that run on every pull request) and protection on the `main` branch.
- The hosting: Vercel (the website) and Neon (the database), the GitHub secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`, `APP_URL`, `CRON_SECRET`), and the build that runs the database migrations.

- **Uses:** nothing.
- **Done when:** a fresh copy runs with `pnpm install`, `pnpm db:start` and `pnpm dev`; the checks pass on GitHub;
  and a merge to `main` shows up on the public website.

#### W2. The database, demo data, and permissions (core Thursday 29 October, the rest Saturday 31 October)

- **Part 1, before the call (scope-proof):** the core tables every version needs: the sign-in tables, `Business`,
  `Role`, `Membership`, `Room`, `RateOverride`, `Booking`, `Occupancy`, `ActivityLog`, `RateLimitWindow`. The
  migration with the database rule that refuses overlapping nights (`occupancy_no_overlap`). And
  `src/server/auth/permissions.ts`: the list of permissions and the default roles. Omar needs it to create a place.
- **Part 2, after the call:** the tables for the features we keep (for example `CalendarFeed`, `Payment`, `Refund`,
  `Payout`, `ApiKey`, `McpAuditLog`, `AiUsage`, `AiChat`, `AiChatMessage`), and the demo data: one guesthouse, an
  owner, a staff member, three rooms, bookings in every status, one Airbnb stay and one closed date. Fatima makes it
  realistic later (F6).

- **Uses:** W1.
- **Done when:** `pnpm db:migrate` and `pnpm db:seed` work on an empty database.

#### W3. Tenancy (due Friday 30 October, before the call)

This decides who can do what, and in which business.

- `tenant-context.ts`: `TenantContext`, `can`, `requirePermission`, `requireOwner`.
- `team-service.resolveContext` and `tenantRoute` (the wrapper for every business route).
- `requirePageTenant` and `requirePageAccess` (the same check for pages).
- The test helpers `tests/integration/helpers.ts` and `http.ts`, which everyone uses in their tests.

- **Uses:** W2 part 1, and sign-in from Omar (O1, Thursday).
- **Done when:** a business route answers 404 to a non-member and works for a member, and a first
  `tenant-isolation.test.ts` passes.

#### W4. The booking engine (start Thursday 29 October, due Sunday 1 November)

The safe way to save and change bookings, used by Fatima's and Omar's features:

- `booking-policy.ts`, `booking-status.ts`, `pricing.ts`, `booking-repository.ts`, `constraint-errors.ts`.
- In `booking-service.ts`:
  - `requestBooking`: lock the room, expire old holds, refuse nights taken on Airbnb or Booking.com, save the booking
    and its night range together, and turn the database's refusal into a clear 409 error.
  - `confirmBooking`, `declineBooking`, `cancelBooking`, `cancelStayAsGuest`, `getBookingForGuest`, with the status
    rules.

- **Uses:** W2, W3.
- **Done when:** `booking-flow.test.ts`, `booking-race.test.ts` and `occupancy-constraint.test.ts` pass. Then Fatima
  and Omar connect their buttons on Monday 2 November, one day before Checkpoint 1.

#### W5. Live data and scheduled jobs (due Monday 2 November)

- Add the demo data to the live database, with a private `SEED_PASSWORD`.
- Add `.github/workflows/scheduled-jobs.yml`. It calls the calendar sync and the hold expiry every 15 minutes.
- Try the main flow on two phones on the public website before Checkpoint 1.

- **Uses:** W1, W2.
- **Done when:** the public website shows the demo guesthouse, and the scheduled jobs run.

#### W6. Calendar sync with Airbnb and Booking.com, from start to end (due Thursday 5 November)

- `ical/safe-fetch.ts`, `parse-feed.ts`, `build-feed.ts`.
- The sync part of `calendar-repository.ts` and `calendar-service.ts`: `addFeed`, `removeFeed`, `syncFeed`,
  `syncFeedNow`, `getChannelSetup`, `refreshRoomFeeds`, `syncDueFeeds`, `buildRoomExport`.
- The routes: the feeds routes, `/api/ical/[token]` and `/api/cron/sync-feeds`.
- The **channels screen**: each room's export link with a copy button, a form to connect an Airbnb or Booking.com
  link, the last sync time and error, and a "Sync now" button.
- `confirmBooking` reads the room's calendars again before confirming.

- **Uses:** W2 and W4 (both Wouroud's). Airbnb nights then show on Omar's calendar board by themselves.
- **Done when:** `ical.test.ts` and the sync part of `calendar.test.ts` pass, and an owner connects a calendar link
  from a phone.

#### W7. Online deposits and payouts, from start to end (due Saturday 7 November)

- The Whish client with its built-in simulator, and the Stripe client in test mode.
  - We do not have a Whish merchant account yet, so Whish runs on the simulator (`WHISH_MODE=simulator`). The
    simulator is **not** temporary code: it is a permanent mode that follows Whish's real API (version 1.4.4).
    When we get a Whish account, we set `WHISH_MODE=sandbox` and add the keys. No code changes.
  - Cards are not simulated: they use Stripe's real test mode.
- `money-repository.ts`, `online-payment-service.ts`, `payout-service.ts`.
- The routes: checkout, the Whish callback and the Stripe webhook.
- The screens:
  - the **"Pay deposit" buttons** on the guest's confirmation page (`pay-online.tsx`). Fatima owns that page; this
    pull request adds the buttons to it.
  - the owner's **payouts page**: what money is held, and a form to ask for a payout to Whish or a bank account.
  - the admin page that marks a payout as sent.

- **Uses:** W4.
- **Done when:** `money.test.ts` passes, a guest pays a deposit on a phone through the Whish simulator, and an owner
  asks for a payout.

#### W8. The whole AI feature, from start to end (due Monday 9 November)

- **The engine:** `src/server/ai/tool.ts`, `run-tool.ts`, `deepseek.ts`, `assistant.ts` (with the fallback when
  the model fails), `team-tools.ts`, `guest-tools.ts`, and `ai-usage-service.ts` (the monthly budget).
- **The owner's assistant:** `assistant-service.ts` (`askTeamAssistant`, `runConfirmedAction`), `chat-service.ts`
  (saved chats), the assistant routes, and the screens: `chat-panel.tsx`, `team-assistant.tsx`, `action-card.tsx`
  (the card with Confirm and "Don't do it") and the assistant page.
- **The guest's assistant:** `askConcierge` with place cards, `/api/assistant`, `/api/me/chats`, and the page with
  `concierge.tsx`.
- **Connecting Claude, Cursor or Codex:** `mcp-server.ts`, `/api/mcp` and `/api/mcp/guest`, `mcp-token.ts`,
  `api-key-service.ts` and its routes, and the keys screen (`key-manager.tsx`).

- **Uses:** other people's services, which are all merged by then (analytics on Friday 6 November).
- **Done when:** `assistant.test.ts`, `mcp-server.test.ts`, `ai-usage.test.ts`, `mcp-isolation.test.ts`,
  `assistant-actions.test.ts` and `chats.test.ts` pass. An owner confirms an AI action on a phone. A guest gets
  place cards. An owner connects Claude Code with a key and asks a question.

#### W9. Prove business isolation and roles (due Tuesday 10 November)

- Finish `tenant-isolation.test.ts` for every area.

#### W10. Release work (Wednesday 11 to Friday 13 November)

Fix bugs, update the documents (`pnpm docs`), finish the README, and record the backup video with Fatima.

### Omar

#### O1. Sign in, accounts and creating a place, from start to end (sign-in Thursday 29 October, all by Saturday 31 October)

- Better Auth: `src/server/auth/better-auth.ts`, the `/api/auth/[...all]` route, and `src/lib/auth-client.ts` with
  `signOutAndLeave`.
- The pages: sign in, sign up and forgot password in `src/app/(auth)/`, with `auth-form.tsx`, and the `SignOutButton`.
- `/home`: sends owners to their dashboard and guests to the home page.
- Creating a place: `onboarding-service.createWorkspace` (the business, the owner role and the default roles, all
  together), `POST /api/workspaces`, and the "Create your place" screen (`create-workspace-form.tsx`).

- **Uses:** W1 (ready Wednesday evening), the permissions and roles list from W2 part 1 (ready Thursday).
- **Order:** sign in, sign up and sign out on Wednesday evening and Thursday (scope-proof). Creating a place on
  Friday and Saturday, with the real roles.
- **Done when:** a person signs up, creates a place, becomes its owner, signs out and signs in again, on a phone, in
  English and Arabic.

#### O2. Rooms and prices, from start to end (due Wednesday 4 November)

- `room-repository.ts`, `room-service.ts` (`listRooms`, `getRoom`, `createRoom`, `updateRoom`, `findRoomByNameOrId`,
  special prices), the input checks and the routes.
- The rooms pages with `room-editor.tsx` and `special-prices.tsx`.

- **Uses:** the database (W2, Thursday) and tenancy (W3, Friday).
- **Order:** the repository, the service and their tests first. The routes and pages after.
- **Done when:** `rooms.test.ts` passes, and an owner adds and edits rooms from a phone.

#### O3. The owner's bookings and decisions, from start to end (due Tuesday 3 November)

- `listBookings`, `getBooking`, `getBookingByReference`. Use `presentForStaff` to hide guest phone and email from
  staff who are not allowed to see them.
- The routes, including `POST .../bookings/[bookingId]/[action]`.
- The bookings list (waiting requests first), the booking details page with the countdown, and
  `booking-actions.tsx` (Confirm, Decline and Cancel, each with an "are you sure?" step).
- The buttons call the booking engine: `confirmBooking`, `declineBooking`, `cancelBooking`.

- **Uses:** the demo bookings (W2, Saturday), tenancy (W3, Friday), and the booking engine (W4, Sunday).
- **Order:** the list, the details page and their routes first (they read the demo bookings). Connect Confirm,
  Decline and Cancel on Monday, after the engine is merged.
- **Done when:** `booking-actions.test.ts` passes, and an owner confirms and declines from a phone.

#### O4. The calendar board and closed dates, from start to end (due Friday 6 November)

- In `calendar-service.ts` and `calendar-repository.ts`: `getCalendarBoard`, `addBlock`, `moveBlock`, `removeBlock`.
- The calendar and blocks routes.
- The board: `calendar-board.tsx`, `calendar-side-panel.tsx`, `close-dates-form.tsx`, `calendar-model.ts`. Build
  the month view first. Add the week and rooms views if there is time.

- **Uses:** the `Occupancy` table. The demo data has an Airbnb stay, so imported nights show even before W6.
- **Done when:** the blocks part of `calendar.test.ts` passes, and an owner closes and moves dates from a phone.

#### O5. Team and roles, from start to end (due Sunday 8 November)

- Members and roles in `team-service.ts` and `team-repository.ts`, and their routes.
- The team page with `member-controls.tsx` and `role-editor.tsx`, and the switcher between businesses.

- **Uses:** W3.
- **Done when:** `roles.test.ts` passes.

#### O6. Release work (Wednesday 11 to Friday 13 November)

Fix bugs in your features. No new features.

### Fatima

#### F1. Design system, app frame and languages (basics Thursday 29 October, the rest Saturday 31 October)

We do **not** design a new look. The new project looks and works exactly like the reference project: the same
themes (five colour palettes, light and dark), the same colours, the same components and the same layouts. Nobody
chooses new colours, fonts or styles. The job is to bring the existing design over exactly, and to make sure
everyone uses it.

- Wednesday evening and Thursday (everyone needs these, and they are scope-proof): `globals.css` with every
  colour token, `Button` and `ButtonLink`, `Field`, `FormError`, `PageHeader` and `Panel`, `inputClass` and
  `panelClass`.
- By Saturday: `TextArea`, `LabeledControl`, `useConfirm`, `SheetDialog`, `Skeleton`, `LoadingStatus`,
  `choiceChipClass`, the app frame (side menu, top bar, phone tab bar), English and Arabic with next-intl
  (`messages/en.json` and `ar.json`), right-to-left for Arabic, and the light/dark switch.

- **Uses:** W1 (ready Wednesday evening).
- **Done when:** a sample page works in light, dark, English and Arabic on a 390-pixel-wide screen, uses colour
  tokens only, and looks the same as the reference project.

#### F2. The guest's booking journey, from start to end (due Tuesday 3 November)

- `directory-repository.ts` and `directory-service.ts` (`getPlace`, `quoteRoom`, `getTakenNights`,
  `checkAvailability`).
- The public routes: the price quote, the taken nights, sending a request, and reading a booking by its secret link.
- The place page, `booking-widget.tsx`, the request page with `guest-details-form.tsx`, and the confirmation page
  `/b/[token]`.
- The request route calls the booking engine's `requestBooking`.

- **Uses:** the design basics (F1, Thursday), the demo data (W2, Saturday), and the booking engine (W4, Sunday).
- **Order:** the place page, the booking box, the price quote and the taken nights first (they only read the
  database). The confirmation page next (it reads the demo bookings). Connect "Send request" on Monday, after the
  engine is merged.
- **Done when:** a guest books from start to end on a phone, a taken night cannot be chosen, and wrong input shows a
  calm message next to the field.

#### F3. Analytics and the money saved on commission, from start to end (due Friday 6 November)

- `analytics-repository.ts`: nights sold by channel and by month, direct revenue, and the typical response time.
  Use safe `$queryRaw` with `${value}` placeholders.
- The real `analytics-service.ts`: `getBusinessReport`, `getAnalytics` (one place or all places), `getSavings`.
- The analytics route and the analytics page, with period and place filters and charts (`analytics-charts.tsx`).
- The dashboard overview (`stat-tile.tsx`, `bar-chart.tsx`, `channel-colors.ts`): arrivals and departures today,
  waiting requests, direct bookings and the money saved.
- Money saved = direct revenue × the business's commission rate (`commissionRateBps`). This is the number we show
  on stage.

- **Uses:** the demo bookings.
- **Done when:** `analytics.test.ts` passes, and the overview shows direct bookings and money saved on a phone.

#### F4. Settings and the list of places, from start to end (due Saturday 7 November)

- The real `settings-service.ts`, its route, and `settings-form.tsx`: contact, currency, deposit percent, how long a
  request is held, commission rate, request or instant booking, how guests pay, and the refund policy.
- The home page that lists places, with `place-card.tsx`.

- **Uses:** W3 for `TenantContext`.
- **Done when:** changing the deposit percent changes the deposit on the next booking.

#### F5. What the guest receives: emails and cancelling, from start to end (due Sunday 8 November)

- The guest's emails in `notification-service.ts` and `src/server/email/templates.ts`: request received, confirmed,
  declined, expired and cancelled.
  - They are in the guest's language (right-to-left in Arabic).
  - Text written by guests is escaped (made safe).
  - Each email has a plain-text version.
  - Emails are sent with `inBackground`, so an email problem never breaks a booking.
- The "Cancel my booking" button on the confirmation page, with an "are you sure?" step and a reason.
- Its route `POST /api/public/bookings/[token]/cancel`, and the line that shows the refund.
- The route calls the booking engine's `cancelStayAsGuest`.

- **Uses:** the booking engine (W4, merged Sunday 1 November).
- **Order:** the emails and the cancel route can be built right away; the engine is merged long before.
- Without an email key, emails are printed in the log, which is enough to check them.
- **Done when:** `email.test.ts` and `guest-cancel.test.ts` pass, and a guest cancels from the confirmation page on a
  phone.

#### F6. Realistic Lebanese demo data (due Monday 9 November)

Make the small demo data from W2 look real:

- Lebanese guesthouse names and areas (Batroun, Deir el Qamar, Hamra, Jounieh, Ehden).
- Rooms with prices in USD.
- Guests with Lebanese names and `+961` phone numbers.
- Some months of past and future bookings, one Airbnb stay, and one clash to show.
- No "(demo)", no "test", no fake Latin text.

- **Uses:** the database (W2) only.
- **Done when:** `seed.test.ts` passes, and every screen in the main flow looks like a real business.

#### F7. The demo works every time: browser tests and the phone check (due Tuesday 10 November)

- Set up Playwright: `@playwright/test`, `playwright.config.ts` with a 390-pixel phone screen, the `tests/e2e/`
  folder, and `pnpm test:e2e`.
- Write `core-flow.spec.ts` (a guest books, the owner confirms, the guest sees "confirmed") and
  `mobile-and-languages.spec.ts`.
- Give every screen of your features a loading screen (`loading.tsx`), an empty state, and calm error messages.
- Check every screen in the main flow at 390 pixels, in English and Arabic. If another person's screen has a
  problem, tell its owner.

- **Uses:** the running app. The tests click through other people's screens without changing them.
- **Done when:** `pnpm test:e2e` passes, none of your screens breaks on empty or wrong input, and nothing in the
  main flow scrolls sideways on a phone.

#### F8. Release work (Wednesday 11 to Friday 13 November)

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
- Live secrets go in Vercel and in GitHub secrets.
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
