# Mabeet · مبيت

Book Lebanese guesthouses, experiences and services directly with the people who run them.

Hosts skip the 15%+ platform commission, keep Airbnb and Booking.com in sync, and can never be double-booked.
Guests and hosts can also ask an AI, on the site or from Claude and ChatGPT.

> **The headline guarantee:** the database itself refuses a double booking. A test sends 20 requests for the
> last free room at the same moment, and exactly one gets it.

## Who it's for

- **Guests** find a stay, an experience or a service, ask to book or book instantly, pay the host or pay online,
  and reach the host by WhatsApp or the Contact host page.
- **Hosts** run rooms or a whole place, sessions, one shared calendar, requests, payments, analytics with AI
  reports, payouts and their team, across all their places.
- **Staff** see and do only what their role allows, whether they use the screens or an AI.
- **Platform admins** watch the platform, open any business to help, approve plan payments made by hand, send
  payouts and can suspend a business.

English, Arabic and Lebanese Arabic throughout, designed for phones first. Mabeet installs on a phone's home screen
and sends push notifications for everything it would email.

## Run it on your computer

You need Node 20 or newer and pnpm. You don't need to install Postgres: the project brings its own.

```bash
pnpm install
cp .env.example .env    # then fill in the values (see "Settings" below)
pnpm db:start           # starts the project's own database; leave this terminal open
pnpm db:deploy          # creates the tables
pnpm db:seed            # adds demo places, experiences and accounts
pnpm dev                # open http://localhost:3000
```

**Demo accounts.** All use the password `demo-password-123` (or your `SEED_PASSWORD`, if you set one):

| Email               | What it is                                              |
| ------------------- | ------------------------------------------------------- |
| `admin@mabeet.test` | Platform admin. Go to `/admin` after signing in         |
| `host@mabeet.test`  | Owner of every demo place. Go to `/dashboard`           |
| `staff@mabeet.test` | Front desk staff at Dar Al Sindiyan. Go to `/dashboard` |
| `guest@mabeet.test` | A guest with an account                                 |

The front desk role handles bookings, guests, deposits and closed dates, but can't see the numbers, change rooms
or settings, or manage the team. Owners can change that on the **Team** page.

The seed also adds about five months of past and two months of upcoming demo bookings, payments, reviews and
notifications, so the calendar, analytics and money pages have something to show. They are fictional and their
references start with `DEMO`.

## Settings (`.env`)

| Setting                                 | What it's for                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `TEST_DATABASE_URL`     | The main database and a test one (tests wipe the test one)                                                                                                                        |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sign-in. The URL is also used in emails and AI connection links                                                                                                                   |
| `CRON_SECRET`                           | Protects the scheduled jobs (calendar sync, expiring holds)                                                                                                                       |
| `DEEPSEEK_API_KEY`                      | Turns on the AI concierge and assistant. Optional                                                                                                                                 |
| `RESEND_API_KEY`, `EMAIL_FROM`          | Sends emails. Without a key they are only logged. Email verification turns on once `EMAIL_FROM` is on your own verified domain (Resend's test sender only reaches your own inbox) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Turns on push notifications. Make a pair with `pnpm push:keys`. Optional                                                                                                          |
| `AI_MONTHLY_BUDGET_USD`                 | Monthly AI spending cap ($50 by default). Admins are warned at 80%                                                                                                                |
| `STRIPE_*`                              | Card payments (host plans and guests paying online), in Stripe test mode. See "Testing card payments" below                                                                       |
| `WHISH_MODE`, `WHISH_*`                 | Whish payments. `simulator` (the default) runs a stand-in Whish page inside the app: phone `96170123456`, code `111111`. Set `sandbox` once Whish issues keys                     |

### Testing card payments

Stripe can't reach `localhost`, so the Stripe CLI passes its events along. Install it once
(`winget install Stripe.StripeCli`), then, with the app running:

```bash
STRIPE_API_KEY=sk_test_… stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,invoice.paid,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted
```

Put the signing secret it prints into `STRIPE_WEBHOOK_SECRET`. On the dashboard's Billing page, pay with the test
card `4242 4242 4242 4242`, any future date and any CVC.

## Useful commands

| Command                 | What it does                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| `pnpm check`            | Types, lint, formatting, unused code and unit tests in one go           |
| `pnpm test:integration` | Tests against a real database, including the race and isolation tests   |
| `pnpm smoke`            | Clicks through guest, host, admin and outsider flows on a running app   |
| `pnpm edge-cases`       | Tries what should fail (bad input, wrong roles, other businesses' ids)  |
| `pnpm payments`         | Pays, refunds and pays out through the Whish simulator on a running app |
| `pnpm run docs`         | Regenerates the full database diagram and the API contract              |

## How it's built

One Next.js app in TypeScript, with PostgreSQL through Prisma, Better Auth for sign-in, next-intl for the three
languages, and Tailwind for styling.

The code has three layers, and the linter stops anyone from skipping one:

```
routes and pages  →  services  →  repositories  →  database
  (read input,        (every rule,     (the only code that
   check it)           permission       talks to the database)
                       and business)
```

The website, the AI chat and both AI connectors (MCP) call the same services. So a rule or a permission is
written once and applies everywhere. The [architecture](docs/architecture.md) explains each layer, the booking
race, tenant isolation and calendar sync in detail.

**Tests come in layers.** Unit tests cover pricing, status changes, permissions and iCal parsing. Integration
tests run against a real Postgres and include the database rules themselves, the race for the last room and the
last seats, and business isolation over HTTP and MCP. Smoke and failure-case runs click through a live app. The
[requirements matrix](docs/requirements-matrix.md) maps each requirement to its code and its test.

**CI** runs types, lint, formatting, unused code, unit tests, a check that the generated docs are current, and the
integration tests on every pull request. `.github/workflows/scheduled-jobs.yml` calls the calendar sync and hold
expiry every 15 minutes once the `APP_URL` and `CRON_SECRET` repository secrets are set.

## Key decisions

- **One table for every taken night.** Direct bookings, manual blocks and platform imports all go into
  `Occupancy`, where a database rule stops two stays from sharing a room night, even if the code has a bug.
- **Requests hold the room right away.** Two guests never both wait for the same night. Unanswered requests
  expire and free it.
- **The business comes from who you are.** It's never taken from what you send. Another business's records
  simply "don't exist" for you, and tests prove it on the website, the API and the AI connectors.
- **Roles are built, not fixed.** Owners tick the permissions each role gets. Nobody can give away a permission
  they don't have, and read-only AI keys lose every write permission.
- **No commission, ever.** Each host chooses requests or instant booking, and whether guests pay them directly
  (Whish, OMT, cash, bank) or online through Mabeet (Whish or card). Online money is held for the host until the
  stay starts, then paid out on request. Mabeet earns only from plans.
- **The provider decides, not the callback.** A Whish callback or a returning guest only makes Mabeet ask Whish or
  Stripe what happened. Settling is idempotent, and a payment that lands too late is refunded automatically.
- **Calendars both ways.** Each room publishes a private calendar link and reads the platforms' links on a
  schedule. Platforms refresh slowly, so feeds are re-read before a host confirms.

## Documents

- [Architecture](docs/architecture.md): how it's built and why, including the double-booking guarantee
- [Requirements matrix](docs/requirements-matrix.md): each requirement, where it's built and which test proves it
- [Functional requirements](docs/functional-requirements.md): what the app does, for each kind of user
- [Non-functional requirements](docs/non-functional-requirements.md): how well it must work, and how we make sure
- [Data model](docs/data-model.md): the database in plain words, with a diagram
- [Full database diagram](docs/erd.md): every table and column, generated from the code
- [API contract](docs/openapi.json): OpenAPI 3.1, generated from the same checks the API uses

## Known limits

- Airbnb and Booking.com refresh calendars on their own schedule, often every few hours. Clashes are shown to the
  host and never cancelled automatically.
- Kazderni has no public API or calendar link, so hosts add its bookings as manual blocks.
- Whish payments run on a built-in simulator until Mabeet gets Whish merchant keys. The client follows Whish's
  API (v1.4.4) and switches with `WHISH_MODE=sandbox`. Whish's real callbacks refuse `localhost`, so real Whish
  needs the deployed URL.
- Whish only refunds whole payments. Partial Whish refunds (a guest cancelling under a moderate or strict policy)
  appear on the admin's money page to send by hand.
- Payouts are sent by an admin and marked as sent; Mabeet doesn't move money to hosts automatically.
- On iPhone, push notifications only work once Mabeet is added to the Home Screen and opened from there.
- Emails (Contact host messages included) only reach other people's inboxes once a domain is verified on Resend.
  With Resend's test sender they reach only the Resend account's own address.
- Contact host is on place pages. Experience and service pages offer WhatsApp only.
