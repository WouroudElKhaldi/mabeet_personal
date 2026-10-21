import { config } from "dotenv";

// Integration tests run against a separate database that they are free to wipe.
config({ quiet: true });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
process.env.DATABASE_URL = testDatabaseUrl;
