import { COLOR_MODE_STORAGE_KEY } from "@/config/appearance";

/**
 * Runs before first paint so the visitor's light/dark choice never flashes.
 * The palette is not here: the server renders the site-wide palette straight onto <html>.
 */
const script = `(() => {
  try {
    const saved = localStorage.getItem(${JSON.stringify(COLOR_MODE_STORAGE_KEY)});
    document.documentElement.dataset.mode = saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {}
})();`;

export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
