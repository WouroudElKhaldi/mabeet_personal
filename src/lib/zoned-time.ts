// Sessions start at a wall-clock time where the business is (e.g. 17:00 in Beirut), stored as UTC instants.

function offsetMinutes(instant: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** "2026-11-07" + "17:00" in "Asia/Beirut" -> the UTC instant. Correct across summer-time changes. */
export function zonedInstant(isoDate: string, time: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const firstGuess = new Date(wallClockAsUtc - offsetMinutes(new Date(wallClockAsUtc), timeZone) * 60_000);
  return new Date(wallClockAsUtc - offsetMinutes(firstGuess, timeZone) * 60_000);
}

/** Date and time of a session as the guest should read it: in the business's time zone. */
export function formatSessionTime(
  instant: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(instant);
}
