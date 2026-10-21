import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Recreates the test database from the migrations, so the raw SQL constraints are exactly what production gets. */
export default function setup(): void {
  config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
