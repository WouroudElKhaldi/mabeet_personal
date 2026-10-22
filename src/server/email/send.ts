import { env } from "@/server/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Lets Resend drop accidental duplicates, e.g. a retried request. */
  idempotencyKey?: string;
}

export const emailEnabled = () => Boolean(env.RESEND_API_KEY);

/** Sends one email through Resend. Without RESEND_API_KEY it logs instead, so local development needs no account. */
export async function sendEmail(email: Email): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[email not sent: RESEND_API_KEY is empty] to=${String(email.to)} subject="${email.subject}"`,
    );
    return;
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      ...(email.idempotencyKey && { "idempotency-key": email.idempotencyKey }),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend refused the email (${response.status}): ${await response.text().catch(() => "")}`,
    );
  }
}
