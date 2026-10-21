import { APPEARANCE_STORAGE_KEY } from "@/config/appearance";

/**
 * Runs before first paint so the saved mode and palette never flash.
 * Kept tiny and dependency-free on purpose; the provider takes over after hydration.
 */
const script = `(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)}) || "{}");
    const mode = saved.mode === "light" || saved.mode === "dark"
      ? saved.mode
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.dataset.palette = saved.palette || "cedar";
  } catch {}
})();`;

export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
