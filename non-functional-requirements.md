# Non-functional requirements

How well Mabeet must work, and how we make sure. What it does is in the
[functional requirements](functional-requirements.md).

| Area                   | The rule                                                       | How we keep it                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No double bookings** | Two guests can never hold the same room night or the last seat | The database itself refuses overlaps (an `EXCLUDE` constraint and a seat trigger). A test sends 20 requests at once; exactly one wins                        |
| **Business isolation** | One business can never see or change another's data            | The business comes from who you are, never from what you send. Foreign ids answer "not found". Tested over the website, API and MCP                          |
| **Least privilege**    | People and AI only do what their role allows                   | Every rule is checked in the service layer, once, for screens, AI and MCP alike. Read-only keys lose every write permission                                  |
| **Privacy**            | Guest phone and email only for roles allowed to see them       | Contacts are masked otherwise. Calendar links never carry guest details. The AI never receives guests' contact details                                       |
| **Security**           | Safe against the usual web attacks                             | Input validated on every route, strict security headers, hashed keys, rate limits on public forms and AI, a guard against fetching private network addresses |
| **Reliability**        | An email or AI outage never breaks a booking                   | Emails are sent after the booking is saved. AI errors show a friendly message                                                                                |
| **Cost control**       | AI spending can't run away                                     | A monthly budget. Admins are warned at 80%, and AI pauses at 100%                                                                                            |
| **Speed on phones**    | Comfortable on weak mobile data                                | Pages rendered on the server, optimised images, self-hosted fonts, loading skeletons                                                                         |
| **Accessibility**      | Usable with a keyboard or a screen reader                      | Real labels and headings, visible focus, and calmer motion for people who ask for it                                                                         |
| **Maintainability**    | Each rule is written once and easy to find                     | Routes, services and repositories kept apart, enforced by the linter. Strict TypeScript. No unused code (checked by knip)                                    |
| **Quality**            | Every change is checked before it ships                        | CI runs types, lint, formatting, unused code, unit and integration tests on every pull request                                                               |

## Known limits

- Airbnb and Booking.com refresh calendars on their own schedule, often every few hours. Clashes are shown to the
  host and never cancelled automatically.
