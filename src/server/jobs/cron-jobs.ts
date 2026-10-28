import { syncDueFeeds } from "@/server/services/calendar-service";
import { runHousekeeping } from "@/server/services/housekeeping-service";
import { defineJob } from "./queue";

// Scheduled work, run by the worker on the "cron" queue. pg-boss keeps the schedule in the database, so with
// several workers each run still happens once.

const syncFeeds = defineJob("cron", "cron.sync-feeds", async () => {
  console.warn("[cron] calendar sync", await syncDueFeeds());
});

const housekeeping = defineJob("cron", "cron.housekeeping", async () => {
  console.warn("[cron] housekeeping", await runHousekeeping());
});

/** Cron expressions in UTC. */
export const SCHEDULES = [
  { job: syncFeeds, cron: "*/15 * * * *" },
  { job: housekeeping, cron: "*/5 * * * *" },
] as const;
