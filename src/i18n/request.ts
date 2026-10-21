import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/config/appearance";

async function detectLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accepted = (await headers()).get("accept-language") ?? "";
  return accepted.toLowerCase().startsWith("ar") ? "ar" : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
