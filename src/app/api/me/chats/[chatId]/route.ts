import { json, parseParams, requireUser, route } from "@/server/http/route";
import { deleteChat, getChat } from "@/server/services/chat-service";
import { chatParams } from "@/server/validation/schemas";

/** One of the guest's own saved concierge chats. Anyone else's is "not found". */
export const GET = route(async (request, context) => {
  const user = await requireUser(request);
  const { chatId } = await parseParams(context, chatParams);
  return json({ chat: await getChat({ userId: user.id, surface: "concierge", businessId: null }, chatId) });
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request);
  const { chatId } = await parseParams(context, chatParams);
  await deleteChat({ userId: user.id, surface: "concierge", businessId: null }, chatId);
  return json({ ok: true });
});
