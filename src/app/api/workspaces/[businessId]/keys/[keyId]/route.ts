import { json, tenantRoute } from "@/server/http/route";
import { revokeKey } from "@/server/services/api-key-service";
import { keyParams } from "@/server/validation/schemas";

export const DELETE = tenantRoute(keyParams, async ({ ctx, params: { keyId } }) => {
  await revokeKey(ctx, keyId);
  return json({ ok: true });
});
