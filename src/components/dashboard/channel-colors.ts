import type { Channel } from "@/server/services/analytics-service";

/** Each booking channel's colour, the same on every chart; platform channels use their own brand colour. */
const CHANNEL_COLOR: Record<Channel, string> = {
  DIRECT: "bg-accent",
  AIRBNB: "bg-brand-airbnb",
  BOOKING: "bg-brand-booking",
  KAZDERNI: "bg-glow",
  OTHER: "bg-faint",
  MANUAL: "bg-line-strong",
};

export const channelColor = (channel: string): string =>
  CHANNEL_COLOR[channel as Channel] ?? CHANNEL_COLOR.OTHER;
