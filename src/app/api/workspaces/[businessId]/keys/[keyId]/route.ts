import { json, parseParams, requireTenant, route } from "@/server/http/route";
import { revokeKey } from "@/server/services/api-key-service";
import { keyParams } from "@/server/validation/schemas";

export const DELETE = route(async (request, context) => {
  const { businessId, keyId } = await parseParams(context, keyParams);
  const ctx = await requireTenant(request, businessId);
  await revokeKey(ctx, keyId);
  return json({ ok: true });
});
