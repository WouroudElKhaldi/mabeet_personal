import { json, tenantRoute } from "@/server/http/route";
import { cancelSession } from "@/server/services/offering-service";
import { sessionParams } from "@/server/validation/schemas";

export const DELETE = tenantRoute(sessionParams, async ({ ctx, params: { sessionId } }) => {
  await cancelSession(ctx, sessionId);
  return json({ ok: true });
});
