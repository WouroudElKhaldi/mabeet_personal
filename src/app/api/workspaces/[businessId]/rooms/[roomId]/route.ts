import { json, parseBody, tenantRoute } from "@/server/http/route";
import { getRoom, updateRoom } from "@/server/services/room-service";
import { roomParams, roomUpdate } from "@/server/validation/schemas";

export const GET = tenantRoute(roomParams, async ({ ctx, params: { roomId } }) => {
  return json(await getRoom(ctx, roomId));
});

export const PATCH = tenantRoute(roomParams, async ({ request, ctx, params: { roomId } }) => {
  await updateRoom(ctx, roomId, await parseBody(request, roomUpdate));
  return json({ ok: true });
});
