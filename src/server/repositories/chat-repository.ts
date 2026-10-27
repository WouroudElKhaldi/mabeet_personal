import type { Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Saved assistant conversations. Every query filters by the person and the surface (and business for the team
// assistant), so a chat is only ever reachable by the person who had it, where they had it.

export interface ChatScope {
  userId: string;
  surface: "team" | "concierge";
  businessId: string | null;
}

const scopeWhere = (scope: ChatScope) => ({
  userId: scope.userId,
  surface: scope.surface,
  businessId: scope.businessId,
});

export function listChats(db: Db, scope: ChatScope, take: number) {
  return db.aiChat.findMany({
    where: scopeWhere(scope),
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, title: true, updatedAt: true },
  });
}

export function findChat(db: Db, scope: ChatScope, chatId: string) {
  return db.aiChat.findFirst({
    where: { id: chatId, ...scopeWhere(scope) },
    select: {
      id: true,
      title: true,
      messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, data: true } },
    },
  });
}

export function createChat(db: Db, scope: ChatScope, title: string) {
  return db.aiChat.create({ data: { ...scopeWhere(scope), title }, select: { id: true } });
}

/** Adds the question and its answer; also marks the chat as recently used. */
export async function appendTurn(
  tx: Tx,
  chatId: string,
  question: string,
  answer: { content: string; data: Prisma.InputJsonValue | null },
) {
  const asked = new Date();
  await tx.aiChatMessage.createMany({
    data: [
      { chatId, role: "user", content: question, createdAt: asked },
      // A millisecond later, so the order survives however the two land.
      {
        chatId,
        role: "assistant",
        content: answer.content,
        data: answer.data ?? undefined,
        createdAt: new Date(asked.getTime() + 1),
      },
    ],
  });
  await tx.aiChat.update({ where: { id: chatId }, data: { updatedAt: new Date() }, select: { id: true } });
}

export async function deleteChat(db: Db, scope: ChatScope, chatId: string) {
  const { count } = await db.aiChat.deleteMany({ where: { id: chatId, ...scopeWhere(scope) } });
  return count > 0;
}
