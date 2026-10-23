import { z } from "zod";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";
import { messageHost } from "@/server/services/contact-service";
import { hostMessageInput } from "@/server/validation/schemas";

const params = z.object({ slug: z.string().min(1).max(64) });

// Each message lands in a host's inbox, so a script must not be able to flood one.
const MESSAGES_PER_ADDRESS = 5;
const WINDOW_MS = 60 * 60_000;

/** A guest's question to the host, from the place's Contact host page. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`host-message:${clientAddress(request)}`, MESSAGES_PER_ADDRESS, WINDOW_MS);
  const { slug } = await parseParams(context, params);
  await messageHost(slug, await parseBody(request, hostMessageInput));
  return json({ ok: true }, 201);
});
