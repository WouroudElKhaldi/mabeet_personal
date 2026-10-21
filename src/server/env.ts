import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CRON_SECRET: z.string().min(24),
  DEEPSEEK_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
