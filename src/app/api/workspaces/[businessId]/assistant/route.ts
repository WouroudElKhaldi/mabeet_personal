import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { askTeamAssistant } from "@/server/services/assistant-service";
import { chatInput, workspaceParams } from "@/server/validation/schemas";

const MESSAGES_PER_MINUTE = 15;

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  enforceRateLimit(`assistant:${ctx.membershipId}`, MESSAGES_PER_MINUTE, 60_000);
  const { messages } = await parseBody(request, chatInput);
  return json(await askTeamAssistant(ctx, messages));
});
