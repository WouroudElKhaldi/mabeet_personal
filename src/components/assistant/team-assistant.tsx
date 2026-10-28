"use client";

import { useTranslations } from "next-intl";
import type { TeamAnswer } from "@/server/services/assistant-service";
import { ActionCard } from "./action-card";
import { ChatPanel } from "./chat-panel";

export function TeamAssistant({ businessId }: { businessId: string }) {
  const t = useTranslations("assistant.team");
  return (
    <ChatPanel<TeamAnswer>
      endpoint={`/api/workspaces/${businessId}/assistant`}
      history={{
        list: `/api/workspaces/${businessId}/assistant/chats`,
        item: (chatId) => `/api/workspaces/${businessId}/assistant/chats/${chatId}`,
      }}
      speaker={t("speaker")}
      greeting={t("greeting")}
      suggestions={[t("suggestions.weekend"), t("suggestions.month"), t("suggestions.requests")]}
      // Saved chats come back without their cards: an old proposal is never confirmed by accident later.
      renderAttachment={(answer) =>
        answer.actions?.length ? (
          <div className="grid gap-3">
            {answer.actions.map((action, index) => (
              <ActionCard key={`${action.tool}-${index}`} businessId={businessId} action={action} />
            ))}
          </div>
        ) : null
      }
    />
  );
}
