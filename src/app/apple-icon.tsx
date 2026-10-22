import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/brand/app-icon";

const SIZE = 180;

export const size = { width: SIZE, height: SIZE };
export const contentType = "image/png";

/** The home-screen icon on iPhone and iPad. */
export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={SIZE} />, size);
}
