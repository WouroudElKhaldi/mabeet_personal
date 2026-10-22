import type { MetadataRoute } from "next";
import { BRAND, ICON_SIZES } from "@/config/brand";

/** Makes Mabeet installable on phones and desktops, opening full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND.accent,
    // The arch sits inside the maskable safe zone, so one image serves both purposes.
    icons: ICON_SIZES.flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/icons/${size}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}
