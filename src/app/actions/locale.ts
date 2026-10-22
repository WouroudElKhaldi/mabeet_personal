"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/config/appearance";
import { getCurrentUser } from "@/server/http/session";
import { setMyLocale } from "@/server/services/account-service";

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Signed-in people also get their emails in this language.
  const user = await getCurrentUser();
  if (user && user.locale !== locale) await setMyLocale(user.id, locale);
}
