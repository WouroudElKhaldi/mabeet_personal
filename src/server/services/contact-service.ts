import type { z } from "zod";
import { forbidden, notFound } from "@/server/errors";
import type { hostMessageInput } from "@/server/validation/schemas";
import { getPlace } from "./directory-service";
import { getHostSection } from "./host-service";
import { notifyHostMessage } from "./notification-service";

/**
 * A guest's question from a place's Contact host page, emailed to the people who handle its bookings with the
 * guest's address as reply-to. Hosts who chose WhatsApp only don't get messages this way.
 */
export async function messageHost(slug: string, input: z.infer<typeof hostMessageInput>): Promise<void> {
  const place = await getPlace(slug);
  if (!place) throw notFound("Place");
  const host = await getHostSection(place);
  if (!host.acceptsMessages) throw forbidden("This host answers on WhatsApp only");
  notifyHostMessage({ businessId: place.id, placeName: place.name, ...input });
}
