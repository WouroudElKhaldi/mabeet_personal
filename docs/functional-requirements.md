# Functional requirements

What Mabeet does, by who uses it. How well it must do it is in the
[non-functional requirements](non-functional-requirements.md).

## The problem

Lebanese guesthouse hosts pay 15 to 18% commission to Airbnb and Booking.com. Direct requests get lost in
Instagram and WhatsApp. Hosts who juggle several calendars sometimes sell the same night twice.

## What success looks like

1. Guests book straight from the host's own page.
2. The host sees how much commission that saved them.
3. Nobody is ever double-booked.

## Guests

- **F1. Find a place.** Search stays, experiences and services by dates, guests, area, category, price,
  amenities, tags and accessibility.
- **F2. See the details.** A place page shows photos, rooms, amenities, reviews, a map and house rules. Under
  the photos: how many guests, bedrooms, beds and baths, the rating and review count, and who hosts it. "Meet
  your host" shows the host's years hosting, response rate and time. A photo tour groups photos by room. "Show
  all" (photos, reviews, amenities) opens a popup, a full-screen sheet on a phone. Listings can be shared. An
  experience page shows its sessions and how many spots are left.
- **F2a. Contact the host.** Depending on the host's choice: a WhatsApp button, a Contact host page whose form
  emails the host (who replies straight to the guest), or both. The page first answers what guests usually ask:
  getting there, check-in times, deposit and cancellation, house rules.
- **F3. Book or ask to book.** The guest picks dates (or seats). Depending on the host, they either send a
  request the host accepts, or book instantly. Either way the room is held for them at once, so nobody else can
  take it. A host can also rent the whole place as one unit; then it is booked whole, never room by room.
- **F4. Follow the booking.** Every booking has a private link showing its status, what to pay and a
  WhatsApp button to the host. The guest is also emailed when anything changes.
- **F4a. Pay online.** When the host collects online, the guest pays the deposit or the full amount from the
  booking page, with Whish or a card. An instant booking is confirmed the moment the payment lands; an unpaid one
  ends after 30 minutes and frees the room.
- **F4b. Get refunds.** Cancelling a paid booking refunds the guest by the host's policy (flexible, moderate,
  strict or non-refundable), shown before booking. A host cancelling or declining always refunds in full.
- **F5. Keep an account.** Trips, favourites, an activity history, and one review per stay, written only after
  check-out by the guest who actually stayed.
- **F6. Ask the concierge.** Describe a trip in English, Arabic or Arabizi and get places that are really free on
  those dates.

## Hosts and their staff

- **F7. List rooms and rates.** Rooms, prices per night, special prices for given nights, photos. The place's
  own details (description, rules, photos by area, whole place or by room) live on a "Your place" page.
- **F7a. Host profile.** One profile per host, shared by all their places: name, bio, languages, hosting since,
  and how guests may reach them (WhatsApp, Contact host, or both). Guests see the personal details only if the
  host turns that on.
- **F8. List experiences and services.** Hikes, tastings, transfers and the like, with repeating sessions and a
  number of seats.
- **F9. Decide on requests.** Confirm, decline or cancel, and record payments received in person (Whish, OMT,
  bank or cash). Unanswered requests expire on their own and free the room.
- **F9a. Choose how guests book and pay.** Requests or instant booking; paid to the host directly, or online
  through Mabeet (deposit or full amount); and a refund policy.
- **F10. One calendar.** Direct bookings, manual blocks and Airbnb, Booking.com and Kazderni bookings in one
  view, by month, by week or by room, with a panel for the chosen day. Closed dates can be dragged to new days.
  Each room publishes its own calendar link for the platforms to read, and reads theirs back.
- **F11. Close dates by hand.** For maintenance, or a booking taken by phone or on Kazderni.
- **F12. See the numbers.** Occupancy, direct revenue, where bookings come from, response time and rating, for
  any period, per place or for all of a host's places together. Plus, since joining: the commission Airbnb or
  Booking.com would have taken, what the plan cost, and what the host kept. The AI can write a report from the
  same numbers. Owners with several places get one "All my places" overview.
- **F12a. Get paid out.** See what guests paid online, what is available (stays that have started) and what is
  still upcoming, and ask for a payout to a bank account (IBAN) or a Whish number.
- **F13. Build a team.** Owners invite staff and make their own roles by ticking permissions. Nobody can hand out
  a permission they don't have themselves.
- **F14. Use AI safely.** An assistant in the dashboard, and personal keys or an OAuth sign-in to connect Claude,
  ChatGPT or any MCP app. One key reaches every place the person works in; they name the place they mean. In
  each place the AI sees exactly what that person's role there allows, nothing more, and a read-only key stays
  read-only everywhere. Chats are saved for later, or kept temporary and never stored.
- **F14a. Notifications.** A bell shows the latest five things that happened (requests, payments, cancellations,
  reviews, team changes); "View all" opens the full, paged list.
- **F15. Choose a plan.** Free, Pro or Business, each with its limits (rooms, experiences, team members, AI).
  Paid by card through Stripe (a subscription, switched on the moment Stripe confirms it), with Whish, or by hand:
  bank transfer, Whish, OMT, crypto or cash, then upload the receipt. A plan paid by hand starts when a platform
  admin approves the receipt, for the months paid. Plans are Mabeet's only income: no commission or fee on
  bookings, on any plan.

## Platform admins

- **F16. Run the platform.** Platform numbers, every host with all their businesses, suspend or reactivate a
  business, open any business's dashboard to help (logged under the admin's own name), manage categories, set
  the site's colour palette, watch calendar sync health and AI spending. Every action is logged.
- **F16a. Run the money.** What Mabeet earned from plans (all time, this month, by month, card or Whish), what it
  holds for each host, payout requests to send and mark as sent, and refunds to send by hand. The admin lists
  the ways hosts can pay for plans (bank account, Whish or OMT number, crypto wallet, cash office) and approves
  or rejects each uploaded receipt.

## Everyone

- **F17. Sign in.** Email and password, email verification, password reset.
- **F18. Three languages.** English, Arabic and Lebanese Arabic, right to left included. Anyone can switch from
  the menu.
- **F19. Phone notifications.** Anyone can turn on push notifications on their phone and get every update they
  would be emailed. Guests without an account can follow one booking from its private link.
- **F20. Install the app.** Mabeet can be added to a phone's home screen and opens like an app, with an offline
  page when there is no signal.
- **F21. Find the way back.** Every page has a Back button to the page it belongs to (a room's page goes to its
  place, a place to search), so it works the same after a refresh or from a shared link.

## Not in this version

Real Whish payments (Mabeet has no Whish keys yet; a simulator that speaks Whish's API stands in), automatic
payouts (an admin sends each one and marks it), in-app chat, automatic pricing, native mobile apps (the website
installs as an app instead).
