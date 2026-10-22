import { json, tenantRoute } from "@/server/http/route";
import { listChats } from "@/server/services/chat-service";
import { workspaceParams } from "@/server/validation/schemas";

/** The member's own saved assistant chats in this business, newest first. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) =>
  json({ chats: await listChats({ userId: ctx.userId, surface: "team", businessId: ctx.businessId }) }),
);
