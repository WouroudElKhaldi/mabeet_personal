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
- **F2. See the details.** A place page shows photos, rooms, amenities, reviews, a map and house rules. An
  experience page shows its sessions and how many spots are left.
- **F3. Ask to book.** The guest picks dates (or seats) and sends a request. The room is held for them at once,
  so nobody else can take it while the host decides.
- **F4. Follow the booking.** Every booking has a private link showing its status, the deposit to pay and a
  WhatsApp button to the host. The guest is also emailed when anything changes.
- **F5. Keep an account.** Trips, favourites, an activity history, and one review per stay, written only after
  check-out by the guest who actually stayed.
- **F6. Ask the concierge.** Describe a trip in English, Arabic or Arabizi and get places that are really free on
  those dates.

## Hosts and their staff

- **F7. List rooms and rates.** Rooms, prices per night, special prices for given nights, photos.
- **F8. List experiences and services.** Hikes, tastings, transfers and the like, with repeating sessions and a
  number of seats.
- **F9. Decide on requests.** Confirm, decline or cancel, and record the deposit (Whish, OMT, bank or cash).
  Unanswered requests expire on their own and free the room.
- **F10. One calendar.** Direct bookings, manual blocks and Airbnb, Booking.com and Kazderni bookings in one
  view. Each room publishes its own calendar link for the platforms to read, and reads theirs back.
- **F11. Close dates by hand.** For maintenance, or a booking taken by phone or on Kazderni.
- **F12. See the numbers.** Occupancy, direct revenue, commission saved, where bookings come from, and rating.
- **F13. Build a team.** Owners invite staff and make their own roles by ticking permissions. Nobody can hand out
  a permission they don't have themselves.
- **F14. Use AI safely.** An assistant in the dashboard, and personal keys or an OAuth sign-in to connect Claude,
  ChatGPT or any MCP app. The AI sees exactly what that person's role allows, nothing more.
- **F15. Choose a plan.** Free, Pro or Business, paid by card through Stripe (test mode for now). No commission on
  bookings, on any plan.

## Platform admins

- **F16. Run the platform.** Platform numbers, suspend or reactivate a business, manage categories, set the
  site's colour palette, watch calendar sync health and AI spending. Every action is logged.

## Everyone

- **F17. Sign in.** Email and password, email verification, password reset.
- **F18. Three languages.** English, Arabic and Lebanese Arabic, right to left included. Anyone can switch from
  the menu.
- **F19. Phone notifications.** Anyone can turn on push notifications on their phone and get every update they
  would be emailed. Guests without an account can follow one booking from its private link.
- **F20. Install the app.** Mabeet can be added to a phone's home screen and opens like an app, with an offline
  page when there is no signal.

## Not in this version

Instant booking, online payment of deposits for Lebanese hosts, payouts, in-app chat, automatic pricing,
native mobile apps (the website installs as an app instead).
