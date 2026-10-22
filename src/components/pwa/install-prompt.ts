"use client";

import { useSyncExternalStore } from "react";

/** Chrome, Edge and Samsung Internet fire this when the site can be installed. Not in the DOM typings yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** installed: running from the home screen. ready: one tap installs. ios: Safari's Share menu installs. */
type InstallState = "installed" | "ready" | "ios" | "manual";

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

/** Starts listening once, early, because the browser offers the install only once per page load. */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
}

export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

/** iPhone and iPad, including iPads that report themselves as a Mac. */
export const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function currentState(): InstallState {
  if (isStandalone()) return "installed";
  if (deferred) return "ready";
  return isAppleMobile() ? "ios" : "manual";
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, currentState, (): InstallState => "manual");
  const install = async () => {
    await deferred?.prompt();
    deferred = null;
    changed();
  };
  return { state, install };
}
