import { after } from "next/server";

/**
 * Runs side work (emails) after the response is sent, so a slow or failing mail provider never slows down
 * or breaks a booking. Outside a request (cron scripts, tests) it simply runs detached. Failures are logged.
 */
export function inBackground(label: string, work: () => Promise<unknown>): void {
  const run = () =>
    work().catch((error: unknown) => {
      console.error(`[background] ${label} failed`, error);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}
