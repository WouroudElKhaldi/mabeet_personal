# Mabeet · مبيت

Book Lebanese guesthouses, experiences and services directly with the people who run them.

Hosts skip the 15%+ platform commission, keep Airbnb and Booking.com in sync, and can never be double-booked.
Guests and hosts can also ask an AI, on the site or from Claude and ChatGPT.

> **The headline guarantee:** the database itself refuses a double booking. A test sends 20 requests for the
> last free room at the same moment, and exactly one gets it.

## Who it's for

- **Guests** find a stay, an experience or a service, ask to book, and pay the deposit straight to the host.
- **Hosts** run rooms, sessions, one shared calendar, requests, deposits, numbers and their team.
- **Staff** see and do only what their role allows, whether they use the screens or an AI.
- **Platform admins** watch the platform and can suspend a business.

English and Arabic throughout, designed for phones first.

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

## Settings (`.env`)

| Setting                                 | What it's for                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `TEST_DATABASE_URL`     | The main database and a test one (tests wipe the test one)                                                                                                                        |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sign-in. The URL is also used in emails and AI connection links                                                                                                                   |
| `CRON_SECRET`                           | Protects the scheduled jobs (calendar sync, expiring holds)                                                                                                                       |
| `DEEPSEEK_API_KEY`                      | Turns on the AI concierge and assistant. Optional                                                                                                                                 |
| `RESEND_API_KEY`, `EMAIL_FROM`          | Sends emails. Without a key they are only logged. Email verification turns on once `EMAIL_FROM` is on your own verified domain (Resend's test sender only reaches your own inbox) |
| `AI_MONTHLY_BUDGET_USD`                 | Monthly AI spending cap ($50 by default). Admins are warned at 80%                                                                                                                |
| `STRIPE_*`                              | Host plans, in Stripe test mode. See "Testing card payments" below                                                                                                                |

### Testing card payments

Stripe can't reach `localhost`, so the Stripe CLI passes its events along. Install it once
(`winget install Stripe.StripeCli`), then, with the app running:

```bash
STRIPE_API_KEY=sk_test_… stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted
```

Put the signing secret it prints into `STRIPE_WEBHOOK_SECRET`. On the dashboard's Billing page, pay with the test
card `4242 4242 4242 4242`, any future date and any CVC.

## Useful commands

| Command                 | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm check`            | Types, lint, formatting, unused code and unit tests in one go         |
| `pnpm test:integration` | Tests against a real database, including the race and isolation tests |
| `pnpm smoke`            | Clicks through guest, host, admin and outsider flows on a running app |
| `pnpm run docs`         | Regenerates the full database diagram and the API contract            |

## How it's built

One Next.js app in TypeScript, with PostgreSQL through Prisma, Better Auth for sign-in, next-intl for the two
languages, and Tailwind for styling.

The code has three layers, and the linter stops anyone from skipping one:

```
routes and pages  →  services  →  repositories  →  database
  (read input,        (every rule,     (the only code that
   check it)           permission       talks to the database)
                       and business)
```

The website, the AI chat and both AI connectors (MCP) call the same services. So a rule or a permission is
written once and applies everywhere.

## Key decisions

- **One table for every taken night.** Direct bookings, manual blocks and platform imports all go into
  `Occupancy`, where a database rule stops two stays from sharing a room night, even if the code has a bug.
- **Requests hold the room right away.** Two guests never both wait for the same night. Unanswered requests
  expire and free it.
- **The business comes from who you are.** It's never taken from what you send. Another business's records
  simply "don't exist" for you, and tests prove it on the website, the API and the AI connectors.
- **Roles are built, not fixed.** Owners tick the permissions each role gets. Nobody can give away a permission
  they don't have, and read-only AI keys lose every write permission.
- **Deposits the way Lebanon pays.** Whish, OMT, cash or bank transfer, recorded by the host. Card payment is
  only used for host plans.
- **Calendars both ways.** Each room publishes a private calendar link and reads the platforms' links on a
  schedule. Platforms refresh slowly, so feeds are re-read before a host confirms.

## Documents

- [Functional requirements](docs/functional-requirements.md): what the app does, for each kind of user
- [Non-functional requirements](docs/non-functional-requirements.md): how well it must work, and how we make sure
- [Data model](docs/data-model.md): the database in plain words, with a diagram
- [Full database diagram](docs/erd.md): every table and column, generated from the code
- [API contract](docs/openapi.json): OpenAPI 3.1, generated from the same checks the API uses

## Known limits

- Airbnb and Booking.com refresh calendars on their own schedule, often every few hours. Clashes are shown to the
  host and never cancelled automatically.
- Kazderni has no public API or calendar link, so hosts add its bookings as manual blocks.
- Lebanese hosts can't take card deposits online yet, so deposits are recorded by hand.
