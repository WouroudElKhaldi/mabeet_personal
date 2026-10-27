"use client";

import { clsx } from "clsx";
import { ArrowRight, ArrowUp, EyeOff, History, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ComponentProps, memo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/api-client";
import { RichText } from "./rich-text";

type Role = "user" | "assistant";

interface ChatMessage<Response> {
  role: Role;
  content: string;
  /** The full answer behind an assistant message, for the extra UI under it (e.g. place cards). */
  response?: Response;
}

/** Where saved chats live; absent when they can't be saved (a visitor who isn't signed in). */
interface ChatHistoryEndpoints {
  list: string;
  item: (chatId: string) => string;
}

interface SavedChat {
  id: string;
  title: string;
  updatedAt: string;
}

interface SavedChatDetail {
  id: string;
  messages: Array<{ role: Role; content: string; data: unknown }>;
}

type RenderAttachment<Response> = (response: Response) => ReactNode;

interface ChatPanelProps<Response extends { reply: string }> {
  endpoint: string;
  history: ChatHistoryEndpoints | null;
  suggestions: string[];
  greeting: string;
  /** Who answers, shown beside each reply, e.g. "Mabeet concierge". */
  speaker: string;
  renderAttachment?: RenderAttachment<Response>;
}

/** The server takes the last 20 messages; older ones are dropped from what the model sees. */
const MAX_SENT_MESSAGES = 20;
const MAX_DRAFT_LENGTH = 2000;
const MAX_INPUT_HEIGHT_PX = 160;

/**
 * A conversation laid out like a travel desk, not a messenger: the concierge writes notes on the page,
 * your questions sit as short tags on the right, and the first questions are offered as idea tickets.
 * Typing re-renders only the composer; the message list re-renders only when messages change.
 */
export function ChatPanel<Response extends { reply: string }>({
  endpoint,
  history,
  suggestions,
  greeting,
  speaker,
  renderAttachment,
}: ChatPanelProps<Response>) {
  const t = useTranslations("assistant");
  const [messages, setMessages] = useState<ChatMessage<Response>[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [saved, setSaved] = useState<SavedChat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Keyed on the URL string: `history` itself is a new object on every parent render.
  const historyUrl = history?.list ?? null;
  const refreshHistory = useCallback(async () => {
    if (!historyUrl) return;
    try {
      setSaved((await api.get<{ chats: SavedChat[] }>(historyUrl)).chats);
    } catch {
      // The list is a convenience; the chat works without it.
    }
  }, [historyUrl]);

  // Loaded once per history list; it refreshes again after each saved answer.
  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (messages.length > 0 || thinking) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const newChat = (asTemporary = false) => {
    setMessages([]);
    setChatId(null);
    setError(null);
    setTemporary(asTemporary);
    setShowHistory(false);
  };

  const openChat = async (id: string) => {
    if (!history) return;
    setShowHistory(false);
    setError(null);
    try {
      const { chat } = await api.get<{ chat: SavedChatDetail }>(history.item(id));
      setChatId(chat.id);
      setTemporary(false);
      setMessages(
        chat.messages.map(({ role, content, data }) => ({
          role,
          content,
          response:
            role === "assistant" && data ? ({ reply: content, ...(data as object) } as Response) : undefined,
        })),
      );
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
    }
  };

  const removeChat = async (id: string) => {
    if (!history) return;
    try {
      await api.delete(history.item(id));
      if (id === chatId) newChat();
      await refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    const next: ChatMessage<Response>[] = [...messages, { role: "user", content }];
    setMessages(next);
    setThinking(true);
    setError(null);
    try {
      const response = await api.post<Response & { chatId: string | null }>(endpoint, {
        messages: next.slice(-MAX_SENT_MESSAGES).map(({ role, content: body }) => ({ role, content: body })),
        chatId,
        temporary,
      });
      if (response.chatId) {
        setChatId(response.chatId);
        void refreshHistory();
      }
      setMessages([...next, { role: "assistant", content: response.reply || t("noAnswer"), response }]);
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="relative mb-6 flex flex-wrap items-center gap-2">
        <PillButton onClick={() => newChat()}>
          <Plus className="size-4" aria-hidden />
          {t("newChat")}
        </PillButton>
        {history && (
          <PillButton aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
            <History className="size-4" aria-hidden />
            {t("history", { count: saved.length })}
          </PillButton>
        )}
        <PillButton
          aria-pressed={temporary}
          active={temporary || !history}
          disabled={!history}
          onClick={() => newChat(!temporary)}
        >
          <EyeOff className="size-4" aria-hidden />
          {t("temporary")}
        </PillButton>
        <p className="w-full text-xs text-muted">
          {!history ? t("signInToSave") : temporary ? t("temporaryHint") : t("savedHint")}
        </p>
        {showHistory && history && (
          <HistoryMenu
            chats={saved}
            currentId={chatId}
            onOpen={(id) => void openChat(id)}
            onDelete={(id) => void removeChat(id)}
          />
        )}
      </div>

      <div className="space-y-8 pb-6" aria-live="polite">
        <Note speaker={speaker}>{greeting}</Note>
        {messages.length === 0 && <Ideas suggestions={suggestions} onPick={(idea) => void send(idea)} />}
        <MessageList messages={messages} speaker={speaker} renderAttachment={renderAttachment} />
        {thinking && <ThinkingDots label={t("thinking")} />}
        <FormError message={error} />
        <div ref={end} />
      </div>

      <Composer busy={thinking} onSend={(text) => void send(text)} />
    </div>
  );
}

function PillButton({
  active = false,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors disabled:opacity-50",
        active ? "bg-ink text-paper ring-ink" : "ring-line hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function HistoryMenu({
  chats,
  currentId,
  onOpen,
  onDelete,
}: {
  chats: SavedChat[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("assistant");
  return (
    <div className="absolute inset-x-0 top-11 z-20 max-h-80 overflow-y-auto rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line sm:end-auto sm:w-96">
      {chats.length === 0 ? (
        <p className="p-3 text-sm text-muted">{t("noHistory")}</p>
      ) : (
        <ul>
          {chats.map((chat) => (
            <li key={chat.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(chat.id)}
                className={clsx(
                  "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-start text-sm hover:bg-surface-2",
                  chat.id === currentId && "bg-surface-2 font-semibold",
                )}
              >
                {chat.title}
              </button>
              <button
                type="button"
                onClick={() => onDelete(chat.id)}
                aria-label={t("deleteChat")}
                title={t("deleteChat")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Ideas({ suggestions, onPick }: { suggestions: string[]; onPick: (idea: string) => void }) {
  const t = useTranslations("assistant");
  return (
    <div>
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-muted uppercase">{t("ideas")}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onPick(suggestion)}
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
  );
}

/** Memoised: only a new message list re-renders it, never the composer or the thinking dots. */
const MessageList = memo(function MessageList<Response>({
  messages,
  speaker,
  renderAttachment,
}: {
  messages: ChatMessage<Response>[];
  speaker: string;
  renderAttachment?: RenderAttachment<Response>;
}) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((message, index) => (
        <motion.div
          // Messages are only ever appended or replaced as a whole, so the position is a stable key.
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
          {message.response !== undefined && renderAttachment?.(message.response)}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}) as <Response>(props: {
  messages: ChatMessage<Response>[];
  speaker: string;
  renderAttachment?: RenderAttachment<Response>;
}) => ReactNode;

function ThinkingDots({ label }: { label: string }) {
  return (
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
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Owns the draft, so each keystroke re-renders only this form. Enter sends, Shift+Enter adds a line. */
function Composer({ busy, onSend }: { busy: boolean; onSend: (text: string) => void }) {
  const t = useTranslations("assistant");
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  // The box grows with what you type, up to a few lines.
  useEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [draft]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
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
              submit();
            }
          }}
          rows={1}
          maxLength={MAX_DRAFT_LENGTH}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          aria-label={t("send")}
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-[transform,opacity] active:scale-90 disabled:opacity-30"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
      <p className="hidden px-3 pb-1 text-xs text-faint sm:block">{t("enterHint")}</p>
    </form>
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
