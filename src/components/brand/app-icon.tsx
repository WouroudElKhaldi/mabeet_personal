import { BRAND } from "@/config/brand";

/**
 * The wordmark's doorway arch, white on the brand green, kept inside the middle 60% so phones that crop
 * icons to a circle or a squircle (maskable icons) never cut it. Plain styles: it is drawn by next/og.
 */
export function AppIcon({ size }: { size: number }) {
  const arch = Math.round(size * 0.6);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.accent,
      }}
    >
      <svg width={arch} height={arch} viewBox="0 0 32 32">
        <path
          d="M5 28V15a11 11 0 0 1 22 0v13"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M11 28v-8a5 5 0 0 1 10 0v8" fill="#ffffff" />
      </svg>
    </div>
  );
}
