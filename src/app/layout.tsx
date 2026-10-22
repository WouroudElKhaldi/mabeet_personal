import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { AppearanceProvider } from "@/components/theme/appearance-provider";
import { AppearanceScript } from "@/components/theme/appearance-script";
import { isArabic, type Locale } from "@/config/appearance";
import { BRAND } from "@/config/brand";
import { getSitePalette } from "@/server/services/site-service";
import "./globals.css";

// Fonts are self-hosted (src/app/fonts, SIL Open Font License), so builds never depend on reaching Google.
const inter = localFont({
  src: "./fonts/inter-100-900.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});
const plexArabic = localFont({
  src: [
    { path: "./fonts/plex-arabic-400.woff2", weight: "400" },
    { path: "./fonts/plex-arabic-500.woff2", weight: "500" },
    { path: "./fonts/plex-arabic-600.woff2", weight: "600" },
    { path: "./fonts/plex-arabic-700.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
});
// Headlines: Archivo, stretched wide and heavy like a travel poster; Kufi is its Arabic counterpart.
const archivo = localFont({
  src: "./fonts/archivo-100-900.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});
const kufi = localFont({
  src: "./fonts/kufi-100-900.woff2",
  weight: "100 900",
  variable: "--font-kufi",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Book Lebanese guesthouses directly, with no platform fees.",
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, palette] = await Promise.all([getLocale() as Promise<Locale>, getSitePalette()]);
  return (
    <html
      lang={locale}
      dir={isArabic(locale) ? "rtl" : "ltr"}
      data-mode="light"
      data-palette={palette}
      suppressHydrationWarning
      className={`${inter.variable} ${plexArabic.variable} ${archivo.variable} ${kufi.variable}`}
    >
      <head>
        <AppearanceScript />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <AppearanceProvider>{children}</AppearanceProvider>
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
