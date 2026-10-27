"use client";

import { Bell, BellOff, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { InstallButton } from "./install-button";
import { isAppleMobile, isStandalone } from "./install-prompt";

type PushState = "checking" | "on" | "off" | "blocked" | "unsupported" | "needsInstall";

interface PhoneAlertsProps {
  /** The API that saves this device for its owner: the signed-in person, or one booking. */
  api: string;
  /** The server's push key; null when push is turned off, and then only the install part shows. */
  publicKey: string | null;
  title: string;
  body: string;
}

// A browser keeps one push subscription per site, shared by every owner it is saved for (the account, a
// booking). This remembers which owners this device turned on; without storage the switch simply reads "off".
const flagKey = (url: string) => `push:${url}`;

function readFlag(url: string): boolean {
  try {
    return localStorage.getItem(flagKey(url)) === "on";
  } catch {
    return false;
  }
}

function writeFlag(url: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(flagKey(url), "on");
    else localStorage.removeItem(flagKey(url));
  } catch {
    // Nothing to remember it in; see readFlag.
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** iPhones only allow push from the installed app, so Safari in a tab is asked to install first. */
async function detect(url: string): Promise<PushState> {
  if (isAppleMobile() && !isStandalone()) return "needsInstall";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return (await currentSubscription()) && readFlag(url) ? "on" : "off";
}

/** Get push notifications on this device, and install Mabeet as an app. */
export function PhoneAlerts({ api: url, publicKey, title, body }: PhoneAlertsProps) {
  const t = useTranslations("pwa");
  const { run, pending, error } = useAction();
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    if (publicKey) detect(url).then(setState, () => setState("unsupported"));
  }, [url, publicKey]);

  const turnOn = () =>
    run(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey ?? ""),
        }));
      await api.post(url, subscription.toJSON());
      writeFlag(url, true);
      setState("on");
    });

  const turnOff = () =>
    run(async () => {
      const subscription = await currentSubscription();
      if (subscription) await api.delete(url, { endpoint: subscription.endpoint });
      writeFlag(url, false);
      setState("off");
    });

  return (
    <section className="grid gap-6 rounded-2xl p-6 ring-1 ring-line">
      {publicKey && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="size-5 text-accent" aria-hidden />
            {title}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted">{body}</p>
          <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
            {state === "off" && (
              <button type="button" disabled={pending} onClick={turnOn} className={buttonClass()}>
                <Bell className="size-4" aria-hidden />
                {t("turnOn")}
              </button>
            )}
            {state === "on" && (
              <>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                  <Bell className="size-4" aria-hidden />
                  {t("on")}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={turnOff}
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                >
                  <BellOff className="size-4" aria-hidden />
                  {t("turnOff")}
                </button>
              </>
            )}
            {(state === "blocked" || state === "unsupported" || state === "needsInstall") && (
              <p className="max-w-prose text-sm font-semibold">{t(state)}</p>
            )}
          </div>
          <FormError message={error} className="mt-3" />
        </div>
      )}
      <div className={publicKey ? "border-t border-line pt-6" : undefined}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Smartphone className="size-5 text-accent" aria-hidden />
          {t("installTitle")}
        </h2>
        <p className="mt-2 mb-5 max-w-prose text-sm text-muted">{t("installBody")}</p>
        <InstallButton />
      </div>
    </section>
  );
}
