import { toIsoDate } from "@/lib/dates";
import { GUEST_TOOLS } from "@/server/ai/guest-tools";
import { handleMcpRequest, methodNotAllowed } from "@/server/ai/mcp-server";
import { route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";

const CALLS_PER_MINUTE = 30;

/** Public guest MCP: anyone can add it to Claude or ChatGPT. Read-only, listed places only, never books. */
export const POST = route(async (request) => {
  enforceRateLimit(`mcp-guest:${clientAddress(request)}`, CALLS_PER_MINUTE, 60_000);
  return handleMcpRequest(request, {
    name: "guest",
    instructions: `Search Lebanese guesthouses that book direct. Today is ${toIsoDate(new Date())}. Prices are in cents. Only suggest places the tools return, and give the booking link; you cannot book on the guest's behalf.`,
    tools: GUEST_TOOLS,
    context: null,
  });
});

export const GET = route(async () => methodNotAllowed());
export const DELETE = GET;
