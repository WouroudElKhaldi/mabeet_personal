"use client";

import { ArrowRight, ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { RichText } from "./rich-text";
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
  /** Who answers, shown beside each reply, e.g. "Mabeet concierge". */
  speaker: string;
  renderAttachment?: (response: Response) => ReactNode;
}

/**
 * A conversation laid out like a travel desk, not a messenger: the concierge writes notes on the page,
 * your questions sit as short tags on the right, and the first questions are offered as idea tickets.
 */
export function ChatPanel<Response extends { reply: string }>({
  endpoint,
  suggestions,
  greeting,
  speaker,
  renderAttachment,
}: ChatPanelProps<Response>) {
  const t = useTranslations("assistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length > 0 || thinking) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  // The box grows with what you type, up to a few lines.
  useEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }, [draft]);

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
    <div className="flex flex-col">
      <div className="space-y-8 pb-6" aria-live="polite">
        <Note speaker={speaker}>{greeting}</Note>

        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.14em] text-muted uppercase">{t("ideas")}</p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="group flex h-full w-full flex-col justify-between gap-4 rounded-2xl bg-surface p-4 text-start ring-1 ring-line transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-soft hover:ring-line-strong"
                  >
                    <span className="text-[0.6875rem] font-bold tracking-[0.14em] text-accent uppercase">
                      {t("idea", { number: String(index + 1).padStart(2, "0") })}
                    </span>
                    <span className="text-[0.9375rem] leading-snug font-semibold">{suggestion}</span>
                    <ArrowRight
                      className="size-4 text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="space-y-4"
            >
              {message.role === "user" ? (
                <p className="ms-auto w-fit max-w-[80%] rounded-2xl rounded-ee-md bg-ink px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-line text-paper [unicode-bidi:plaintext]">
                  {message.content}
                </p>
              ) : (
                <Note speaker={speaker}>
                  <RichText text={message.content} />
                </Note>
              )}
              {message.attachment}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <div className="flex items-center gap-3 text-sm text-muted" role="status">
            <Monogram />
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
            <span className="sr-only">{t("thinking")}</span>
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
        className="sticky bottom-4 z-10 rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line-strong"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
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
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={!draft.trim() || thinking}
            aria-label={t("send")}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-[transform,opacity] active:scale-90 disabled:opacity-30"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
        <p className="hidden px-3 pb-1 text-xs text-faint sm:block">{t("enterHint")}</p>
      </form>
    </div>
  );
}

function Monogram() {
  return (
    <span
      aria-hidden
      className="font-poster grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm text-accent-ink"
    >
      M
    </span>
  );
}

/** A reply from the concierge: a signed note on the page rather than a bubble. */
function Note({ speaker, children }: { speaker: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Monogram />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">{speaker}</p>
        {/* plaintext bidi: a Latin or Arabizi reply keeps its punctuation in place on an Arabic page. */}
        <p className="mt-1 max-w-[62ch] border-s-2 border-accent-line ps-4 text-[1.0625rem] leading-relaxed whitespace-pre-line [unicode-bidi:plaintext]">
          {children}
        </p>
      </div>
    </div>
  );
}
