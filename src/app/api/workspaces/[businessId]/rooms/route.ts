import { json, parseBody, tenantRoute } from "@/server/http/route";
import { createRoom, listRooms } from "@/server/services/room-service";
import { roomInput, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listRooms(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createRoom(ctx, await parseBody(request, roomInput)), 201);
});
