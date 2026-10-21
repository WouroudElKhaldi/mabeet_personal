import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Readex_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AppearanceProvider } from "@/components/theme/appearance-provider";
import { AppearanceScript } from "@/components/theme/appearance-script";
import { isRtl, type Locale } from "@/config/appearance";
import { BRAND } from "@/config/brand";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "opsz"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Book Lebanese guesthouses directly, with no platform fees.",
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#11100e" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      data-mode="light"
      data-palette="cedar"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${readex.variable}`}
    >
      <head>
        <AppearanceScript />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <AppearanceProvider>{children}</AppearanceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
