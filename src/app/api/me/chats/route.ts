import { json, requireUser, route } from "@/server/http/route";
import { listChats } from "@/server/services/chat-service";

/** The signed-in guest's saved concierge chats, newest first. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json({ chats: await listChats({ userId: user.id, surface: "concierge", businessId: null }) });
});
