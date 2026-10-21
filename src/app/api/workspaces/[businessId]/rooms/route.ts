import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { createRoom, listRooms } from "@/server/services/room-service";
import { roomInput, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await listRooms(ctx));
});

export const POST = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await createRoom(ctx, await parseBody(request, roomInput)), 201);
});
