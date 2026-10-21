import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { getRoom, updateRoom } from "@/server/services/room-service";
import { roomParams, roomUpdate } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId, roomId } = await parseParams(context, roomParams);
  const ctx = await requireTenant(request, businessId);
  return json(await getRoom(ctx, roomId));
});

export const PATCH = route(async (request, context) => {
  const { businessId, roomId } = await parseParams(context, roomParams);
  const ctx = await requireTenant(request, businessId);
  await updateRoom(ctx, roomId, await parseBody(request, roomUpdate));
  return json({ ok: true });
});
