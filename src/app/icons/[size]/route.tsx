import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/brand/app-icon";
import { ICON_SIZES } from "@/config/brand";

export const dynamic = "force-static";

export function generateStaticParams() {
  return ICON_SIZES.map((size) => ({ size: String(size) }));
}

/** The app icon as a PNG, drawn from the same arch as the wordmark. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!ICON_SIZES.some((allowed) => allowed === size)) notFound();
  return new ImageResponse(<AppIcon size={size} />, { width: size, height: size });
}
