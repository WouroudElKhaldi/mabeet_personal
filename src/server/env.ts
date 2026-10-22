import { z } from "zod";

/** An unset or empty variable is undefined, so a copied .env.example never fails validation. */
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), type.optional());

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CRON_SECRET: z.string().min(24),
  DEEPSEEK_API_KEY: z.string().optional(),
  // DeepSeek prices in US dollars per million tokens (check api-docs.deepseek.com/quick_start/pricing).
  AI_INPUT_USD_PER_M: z.coerce.number().nonnegative().default(0.28),
  AI_OUTPUT_USD_PER_M: z.coerce.number().nonnegative().default(0.42),
  // Monthly AI spend cap in US dollars, $50 unless set. Admins get an email at 80%; at 100% the assistants
  // pause until next month.
  AI_MONTHLY_BUDGET_USD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().default(50),
  ),
  // Email through Resend. Without a key, emails are logged instead of sent (local development).
  RESEND_API_KEY: z.string().optional(),
  // Stripe, for host plans. Without the secret key, /pricing shows the plans with checkout turned off.
  STRIPE_SECRET_KEY: optional(z.string().startsWith("sk_")),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith("whsec_")),
  STRIPE_PRICE_PRO: optional(z.string().startsWith("price_")),
  STRIPE_PRICE_BUSINESS: optional(z.string().startsWith("price_")),
  EMAIL_FROM: z.string().default("Mabeet <onboarding@resend.dev>"),
  // Web push to phones (pnpm push:keys makes a pair). Without them, the "notify me" buttons stay hidden.
  VAPID_PUBLIC_KEY: optional(z.string()),
  VAPID_PRIVATE_KEY: optional(z.string()),
  VAPID_SUBJECT: z.string().default("mailto:hello@mabeet.app"),
});

export const env = schema.parse(process.env);
