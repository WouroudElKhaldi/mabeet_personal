import { beforeEach, describe, expect, it } from "vitest";
import { exportMyData } from "@/server/services/account-service";
import { deleteChat, getChat, listChats, saveTurn } from "@/server/services/chat-service";
import { saveMyHostProfile } from "@/server/services/host-service";
import { createPlace, createUser, resetDatabase } from "./helpers";

describe("saved assistant chats", () => {
  beforeEach(resetDatabase);

  it("keeps a chat's turns in order and lists it for its owner", async () => {
    const { owner, business } = await createPlace();
    const scope = { userId: owner.id, surface: "team" as const, businessId: business.id };
    const chatId = await saveTurn(scope, null, "How full is next weekend?", {
      content: "Two of three rooms.",
      data: null,
    });
    await saveTurn(scope, chatId, "And the one after?", { content: "All free.", data: null });

    const chat = await getChat(scope, chatId);
    expect(chat.title).toBe("How full is next weekend?");
    expect(chat.messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(await listChats(scope)).toHaveLength(1);
  });

  it("never opens, continues or deletes someone else's chat", async () => {
    const { owner, business } = await createPlace();
    const mine = { userId: owner.id, surface: "team" as const, businessId: business.id };
    const chatId = await saveTurn(mine, null, "Private question", { content: "Answer", data: null });
    const stranger = await createUser("Stranger");
    const theirs = { userId: stranger.id, surface: "team" as const, businessId: business.id };

    await expect(getChat(theirs, chatId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveTurn(theirs, chatId, "Sneaky", { content: "x", data: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteChat(theirs, chatId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // The same person in another place (or the concierge) doesn't see it either.
    await expect(getChat({ ...mine, surface: "concierge", businessId: null }, chatId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await listChats(theirs)).toEqual([]);
  });

  it("hands the person all of it in Download my data, host profile included", async () => {
    const { owner, business, ctx } = await createPlace();
    await saveTurn(
      { userId: owner.id, surface: "team", businessId: business.id },
      null,
      "Revenue this month?",
      {
        content: "$1,200 so far.",
        data: null,
      },
    );
    await saveMyHostProfile(ctx, {
      languages: ["ar"],
      showOnListings: false,
      contactBy: "BOTH",
      bio: "Hello",
    });
    const data = await exportMyData(owner.id);
    expect(data.aiChats[0]?.messages.map((message) => message.content)).toEqual([
      "Revenue this month?",
      "$1,200 so far.",
    ]);
    expect(data.hostProfile).toMatchObject({ bio: "Hello", showOnListings: false });
  });
});
