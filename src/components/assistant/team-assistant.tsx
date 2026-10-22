"use client";

import { useTranslations } from "next-intl";
import { ChatPanel } from "./chat-panel";

export function TeamAssistant({ businessId }: { businessId: string }) {
  const t = useTranslations("assistant.team");
  return (
    <ChatPanel
      endpoint={`/api/workspaces/${businessId}/assistant`}
      history={{
        list: `/api/workspaces/${businessId}/assistant/chats`,
        item: (chatId) => `/api/workspaces/${businessId}/assistant/chats/${chatId}`,
      }}
      speaker={t("speaker")}
      greeting={t("greeting")}
      suggestions={[t("suggestions.weekend"), t("suggestions.month"), t("suggestions.requests")]}
    />
  );
}
