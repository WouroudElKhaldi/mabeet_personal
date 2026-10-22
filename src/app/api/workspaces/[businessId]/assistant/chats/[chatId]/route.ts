import { json, tenantRoute } from "@/server/http/route";
import { deleteChat, getChat } from "@/server/services/chat-service";
import { chatParams, workspaceParams } from "@/server/validation/schemas";

const params = workspaceParams.and(chatParams);

/** One of the member's own saved chats, with its messages. Anyone else's is "not found". */
export const GET = tenantRoute(params, async ({ ctx, params: { chatId } }) =>
  json({ chat: await getChat({ userId: ctx.userId, surface: "team", businessId: ctx.businessId }, chatId) }),
);

export const DELETE = tenantRoute(params, async ({ ctx, params: { chatId } }) => {
  await deleteChat({ userId: ctx.userId, surface: "team", businessId: ctx.businessId }, chatId);
  return json({ ok: true });
});
