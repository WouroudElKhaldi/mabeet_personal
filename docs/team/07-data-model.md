# Data model for the new project

The new project uses almost the same database as the reference project. The full diagram is in `docs/erd.md`
(made from the reference project's `prisma/schema.prisma`). This file lists **only what changes**, because of the
decisions in `06-functional-requirements.md`.

Rule: every table of every feature is in the schema from the start, including the bonus features (experiences,
plans, AI, push notifications). So nobody waits for a table later.

---

## 1. What stays exactly the same

These tables keep the same columns and meaning as in `docs/erd.md`:

- **Sign-in:** `User`, `Session`, `Account`, `Verification`, and the OAuth tables (`OauthClient`, `OauthAccessToken`,
  `OauthRefreshToken`, `OauthConsent`, `OauthResource`, `OauthClientResource`, `OauthClientAssertion`, `Jwks`).
- **Businesses and teams:** `Business` (except the changes in section 2), `Role`, `Membership`, `HostProfile`.
- **Places:** `Room`, `RateOverride`, `Photo`, `StoredImage`, `Category`, `BusinessCategory`.
- **Calendar:** `Occupancy` (except one column, section 2), `CalendarFeed`.
- **Experiences (bonus):** `Offering`, `OfferingSession`.
- **Money:** `Refund`, `Payout`, `PlanPayment`, `PlatformPaymentOption`, `PlanRequest`, `WebhookEvent`,
  `WhishSandboxPayment` (the Whish simulator).
- **Guests:** `Favorite`, `Review`.
- **Logs and limits:** `ActivityLog`, `RateLimitWindow`, `SiteSetting`.
- **AI:** `ApiKey`, `McpAuditLog`, `AiUsage`, `AiChat`, `AiChatMessage`.
- **Push:** `PushSubscription`.

---

## 2. What changes

### 2.1 One booking mode instead of four settings

**Before:** `Business` had four settings that together made the booking rules: `bookingMode` (`REQUEST` or
`INSTANT`), `paymentCollection` (`AT_PLACE` or `ONLINE`), `onlineAmount` (`DEPOSIT` or `FULL`) and `depositPercent`.

**After:** one setting with the three modes.

```prisma
enum BookingMode {
  AUTOMATIC        // pays online (full amount), confirmed automatically by the payment webhook
  ONLINE_APPROVAL  // pays online (full amount), then the owner confirms or declines
  OFFLINE          // no payment through the platform; the owner confirms or declines by hand
}

model Business {
  // ...
  bookingMode BookingMode @default(OFFLINE)
  holdHours   Int         @default(24) // how long the owner has to answer (modes 2 and 3)
  // removed: paymentCollection, onlineAmount, depositPercent
}
```

Remove the `PaymentCollection` and `OnlineAmount` enums.

### 2.2 No refund policies: refunds are always full

**Before:** `RefundPolicy` (`FLEXIBLE`, `MODERATE`, `STRICT`, `NON_REFUNDABLE`) on `Business`, `Booking` and
`SessionBooking`.

**After:** every refund of an online payment is full and automatic. Remove the `RefundPolicy` enum and the
`refundPolicy` columns.

Add a record that the owner accepted this rule when choosing an online mode:

```prisma
model Business {
  // ...
  onlineTermsAcceptedAt DateTime? // when the owner accepted "online payments are always refunded in full"
}
```

The app refuses to switch a business to `AUTOMATIC` or `ONLINE_APPROVAL` until this is set.

### 2.3 Bookings: the full amount, and the mode used

**Before:** `Booking` had `depositCents`, `onlineDueCents` and `refundPolicy`.

**After:**

```prisma
model Booking {
  // ...
  totalCents    Int
  bookingMode   BookingMode // copied from the business when the booking is made, so later changes do not affect it
  holdExpiresAt DateTime?   // the 10-minute payment window, or the owner's answer time
  // removed: depositCents, onlineDueCents, refundPolicy
}
```

A booking is paid online when `bookingMode` is `AUTOMATIC` or `ONLINE_APPROVAL`, and the amount is always
`totalCents`. Make the same change on `SessionBooking` (bonus).

### 2.4 Booking statuses: the new order

The statuses stay the same (`HELD`, `AWAITING_PAYMENT`, `CONFIRMED`, `DECLINED`, `EXPIRED`, `CANCELLED`). Only the
order changes, because the guest now pays **before** the owner decides:

| Mode                     | Steps                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Automatic             | `AWAITING_PAYMENT` (10 minutes) → `CONFIRMED` when paid · or `EXPIRED` if not paid in time                                                                                                          |
| 2. Online, with approval | `AWAITING_PAYMENT` (10 minutes) → `HELD` when paid (waiting for the owner) → `CONFIRMED` or `DECLINED` (full refund) · `EXPIRED` if not paid in time, or if the owner does not answer (full refund) |
| 3. Offline               | `HELD` (waiting for the owner) → `CONFIRMED` or `DECLINED` · `EXPIRED` if the owner does not answer                                                                                                 |

In every mode, `CONFIRMED` can become `CANCELLED` (with a full refund if it was paid online). This is a code change in
`booking-status.ts` and `booking-policy.ts`, not a table change.

### 2.5 Payments: online only

**Before:** `Payment` also stored payments the owner recorded by hand (cash, OMT, bank), with `recordedById` and an
`online` flag.

**After:** `Payment` only stores online payments (Whish or Stripe). Remove `recordedById` and `online`. The methods
for booking payments are only `WHISH` and `STRIPE`. The other methods (`CASH`, `OMT`, `BANK_TRANSFER`, `CRYPTO`,
`OTHER`) stay in the `PaymentMethod` enum, because hosts still use them to pay for **plans** by hand
(`PlanRequest`, `PlatformPaymentOption`).

### 2.6 Calendar: no Kazderni, and imported nights are not bookings

- `FeedSource` becomes `AIRBNB`, `BOOKING`, `OTHER` (remove `KAZDERNI`). `OTHER` covers any other platform with an
  iCal link, such as Vrbo.
- `Occupancy.source`: remove it. Closed dates (`MANUAL`) only keep a `note`. Imported nights (`IMPORTED`) get their
  source from their `CalendarFeed`.
- Imported nights stay as `Occupancy` rows of kind `IMPORTED`. They block the calendar, but they are not bookings:
  no guest, no money, and they are not counted in the numbers.

### 2.7 Notifications for payments and refunds

No table change. `ActivityLog` already records `payment.online_confirmed`, refunds and expiries, and the bell reads
from it.

### 2.8 Job queues: a `pgboss` schema beside ours

No Prisma change. The worker's queues (`ai`, `notify`, `cron`) live in the same database, in a `pgboss` schema that
pg-boss creates and upgrades itself when it starts. Never add it to `schema.prisma` or write to it with Prisma; use
`src/server/jobs/queue.ts`. Job data holds only ids and plain values. Finished AI jobs are deleted after an hour,
others after a day.

### 2.9 `JobProgress`: the answer while it is written

New table (migration `20261028000100_job_progress`): `jobId` (pg-boss's id, the key), `step` (the tool in use, or
null), `text` (the reply so far), `updatedAt` (indexed, for cleanup). Written by the worker at most every 300 ms,
read by `GET /api/jobs/{jobId}`, deleted when the job ends.

---

## 3. What I checked is not missing

| Feature                                 | Covered by                                                            |
| --------------------------------------- | --------------------------------------------------------------------- |
| The 10-minute payment window            | `Booking.holdExpiresAt` and the housekeeping job (every 5 minutes)    |
| Slow AI work, retried emails, schedules | The `pgboss` schema (pg-boss), not Prisma                             |
| Webhooks applied only once              | `WebhookEvent` (unique event id)                                      |
| A failed automatic refund sent by hand  | `Refund.automatic` and `RefundStatus` (`PENDING` → `DONE`)            |
| Payouts to owners                       | `Payout` (`REQUESTED` → `PAID` or `REJECTED`)                         |
| Commission saved                        | `Business.commissionRateBps` and the confirmed bookings' `totalCents` |
| Email verification                      | `Verification` (Better Auth)                                          |
| Each person's language                  | `User.locale`, `Booking.locale`                                       |
| Contact host choice                     | `HostProfile.contactBy`                                               |
| The bell's "seen" state                 | `User.notificationsSeenAt`                                            |
| Experiences, plans, AI, push (bonus)    | Their tables are kept, so they can be built any time                  |

---

## 4. Summary for the migration

1. `BookingMode`: new values `AUTOMATIC`, `ONLINE_APPROVAL`, `OFFLINE`. Remove `PaymentCollection`, `OnlineAmount`,
   `RefundPolicy`.
2. `Business`: remove `paymentCollection`, `onlineAmount`, `depositPercent`, `refundPolicy`. Add
   `onlineTermsAcceptedAt`.
3. `Booking` and `SessionBooking`: remove `depositCents`, `onlineDueCents`, `refundPolicy`. Add `bookingMode`.
4. `Payment`: remove `recordedById` and `online`.
5. `FeedSource`: remove `KAZDERNI`. `Occupancy`: remove `source`.
6. Keep everything else, including the EXCLUDE rule against overlapping nights.
7. Nothing to migrate for the queues: pg-boss creates its `pgboss` schema when the worker first starts.
8. Add `JobProgress` (live text of queued AI answers).
