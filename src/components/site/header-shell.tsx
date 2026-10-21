"use client";

import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";

/** Sticky header that turns into frosted glass once the page scrolls. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-(--ease-out)",
        scrolled ? "bg-paper/80 shadow-[0_1px_0_var(--line)] backdrop-blur-xl" : "bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
