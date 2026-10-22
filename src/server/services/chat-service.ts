import type { Prisma } from "@prisma/client";
import { prisma, runInTransaction } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as chats from "@/server/repositories/chat-repository";
import type { ChatScope } from "@/server/repositories/chat-repository";

// Saved assistant chats: the history list, opening one, deleting one, and saving each answered turn. A temporary
// chat simply never calls saveTurn. Scopes come from who is signed in (and the business from the URL, already
// checked by the route), never from the request body.

export type { ChatScope };

const HISTORY = 40;
const TITLE_LENGTH = 70;

export function listChats(scope: ChatScope) {
  return chats.listChats(prisma, scope, HISTORY);
}

export async function getChat(scope: ChatScope, chatId: string) {
  const chat = await chats.findChat(prisma, scope, chatId);
  if (!chat) throw notFound("Chat");
  return chat;
}

export async function deleteChat(scope: ChatScope, chatId: string) {
  if (!(await chats.deleteChat(prisma, scope, chatId))) throw notFound("Chat");
}

/**
 * Stores one question and its answer. With no chatId it starts a new chat titled after the question; with one,
 * the chat must belong to this person and place, or it is "not found". Returns the chat's id.
 */
export async function saveTurn(
  scope: ChatScope,
  chatId: string | null,
  question: string,
  answer: { content: string; data: Prisma.InputJsonValue | null },
): Promise<string> {
  const id = chatId
    ? (await getChat(scope, chatId)).id
    : (await chats.createChat(prisma, scope, titleFrom(question))).id;
  await runInTransaction((tx) => chats.appendTurn(tx, id, question, answer));
  return id;
}

function titleFrom(question: string): string {
  const line = question.replace(/\s+/g, " ").trim();
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}
