"use client";

import { clsx } from "clsx";
import { ArrowUp, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Extra UI under an assistant message, e.g. place cards built from tool data. */
  attachment?: ReactNode;
}

interface ChatPanelProps<Response extends { reply: string }> {
  endpoint: string;
  suggestions: string[];
  greeting: string;
  renderAttachment?: (response: Response) => ReactNode;
}

export function ChatPanel<Response extends { reply: string }>({
  endpoint,
  suggestions,
  greeting,
  renderAttachment,
}: ChatPanelProps<Response>) {
  const t = useTranslations("assistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, thinking]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setThinking(true);
    setError(null);
    try {
      const response = await api.post<Response>(endpoint, {
        messages: next.slice(-20).map(({ role, content: body }) => ({ role, content: body })),
      });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: response.reply || t("noAnswer"),
          attachment: renderAttachment?.(response),
        },
      ]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("error"));
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl bg-surface ring-1 ring-line">
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6" aria-live="polite">
        <Bubble role="assistant">{greeting}</Bubble>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full px-4 py-2 text-start text-sm ring-1 ring-line transition-colors hover:bg-accent-soft hover:ring-accent-line"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="space-y-3"
            >
              <Bubble role={message.role}>{message.content}</Bubble>
              {message.attachment}
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && (
          <div className="flex items-center gap-2 text-sm text-muted" role="status">
            <Sparkles className="size-4 animate-pulse text-accent" aria-hidden />
            {t("thinking")}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-[0.9375rem] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          aria-label={t("send")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-[transform,opacity] active:scale-90 disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: ChatMessage["role"]; children: ReactNode }) {
  return (
    <p
      className={clsx(
        "max-w-[85%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-line",
        role === "user"
          ? "ms-auto rounded-ee-sm bg-accent text-accent-ink"
          : "rounded-es-sm bg-surface-2 text-ink",
      )}
    >
      {children}
    </p>
  );
}
