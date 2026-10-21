import type { ReactNode } from "react";
import { HeroLandscape } from "@/components/site/hero-landscape";
import { Wordmark } from "@/components/site/wordmark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Wordmark />
        <main id="main" className="m-auto w-full max-w-sm py-12">
          {children}
        </main>
      </div>
      <div className="relative hidden overflow-hidden bg-surface-2 lg:block">
        <HeroLandscape />
      </div>
    </div>
  );
}
