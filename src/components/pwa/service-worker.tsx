"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "./install-prompt";

/** Registers the service worker on every page, so the site installs as an app and can show notifications. */
export function ServiceWorker() {
  useEffect(() => {
    captureInstallPrompt();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);
  return null;
}
