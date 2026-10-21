import Link from "next/link";
import { BRAND } from "@/config/brand";

/** A hand-set mark: a doorway arch (Lebanese triple-arch houses) with the name beside it. */
export function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5 text-ink" aria-label={BRAND.name}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path
          d="M5 28V15a11 11 0 0 1 22 0v13"
          className="fill-none stroke-current transition-[stroke-dashoffset] duration-700 ease-(--ease-out)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path d="M11 28v-8a5 5 0 0 1 10 0v8" className="fill-accent transition-colors" />
        <circle cx="16" cy="10" r="1.6" className="fill-glow" />
      </svg>
      <span className="font-display text-[1.45rem] leading-none font-semibold tracking-tight italic">
        {BRAND.name}
      </span>
    </Link>
  );
}
