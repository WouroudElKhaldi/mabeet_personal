// Every module that declares jobs, imported for its side effect: declaring a job registers its handler. The worker
// imports this file, so a job declared anywhere else must be added here or the worker will refuse it.
import "./ai-jobs";
import "./cron-jobs";
import "@/server/services/notification-service";
