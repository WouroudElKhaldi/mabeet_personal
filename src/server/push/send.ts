import webpush from "web-push";
import { env } from "@/server/env";

/** What a notification shows, and the page a tap opens. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** A device's push address and the keys its browser gave us to encrypt for it. */
export interface PushDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Browsers hand out endpoints on their vendor's push service. Accepting only those keeps a forged
// subscription from making the server call an address of the attacker's choosing.
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushServiceUrl(endpoint: string): boolean {
  const url = URL.parse(endpoint);
  if (url?.protocol !== "https:") return false;
  return PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export const pushEnabled = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

const GONE = new Set([404, 410]);
const ONE_DAY_SECONDS = 24 * 60 * 60;

/** Sends one message. Resolves false when the device has unsubscribed or expired and should be forgotten. */
export async function sendPush(device: PushDevice, message: PushMessage): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      {
        TTL: ONE_DAY_SECONDS,
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY ?? "",
          privateKey: env.VAPID_PRIVATE_KEY ?? "",
        },
      },
    );
    return true;
  } catch (error) {
    if (GONE.has((error as { statusCode?: number }).statusCode ?? 0)) return false;
    throw error;
  }
}
