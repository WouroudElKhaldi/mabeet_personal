import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, type Locale, pickLocale } from "@/config/appearance";

async function detectLocale(): Promise<Locale> {
  return pickLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
