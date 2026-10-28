import { z } from "zod";
import { unavailable } from "@/server/errors";
import { type ChatMessage, completeJson, type TokenUsage } from "./deepseek";

// Every answer from the model has a stated shape: the shape is sent with the request, and what comes back is checked
// against it before anyone sees it. Chat replies are text in a small markdown subset; reports are JSON with a schema.

const MAX_REPLY_WORDS = 180;
const MAX_REPLY_CHARS = 4_000;

/** The reply format, sent in every chat system prompt. The app renders exactly this subset and nothing else. */
export const REPLY_FORMAT = `Reply format (the app renders only this):
- Short plain sentences. Use **bold** for key figures, names and references.
- A list: one item per line, each starting with "- ".
- Three or more rows of the same kind (bookings, rooms, months): a table with a header row, like
| Reference | Room | Dates | Total |
| --- | --- | --- | --- |
| SN-7KX3P9 | Arched room | 3–7 Nov | $380.00 |
- No headings, no HTML, no code blocks, no links: the app adds cards and buttons under your reply.
- At most ${MAX_REPLY_WORDS} words.`;

/**
 * Brings a model reply into REPLY_FORMAT: code fences and HTML tags are dropped, headings become bold lines, links
 * keep only their text, list markers become "- ", and an over-long reply is cut at a line break. Returns "" when
 * nothing is left, so the caller can show its own fallback.
 */
export function shapeReply(text: string | null | undefined): string {
  const shaped = (text ?? "")
    .replace(/```[\w-]*\n?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+(.+)$/gm, "**$1**")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^(\s*)[*•]\s+/gm, "$1- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (shaped.length <= MAX_REPLY_CHARS) return shaped;
  const cut = shaped.slice(0, MAX_REPLY_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0) || MAX_REPLY_CHARS).trimEnd()}\n…`;
}

const issuesOf = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");

function parse<T>(
  content: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, reason: "the answer was not valid JSON" };
  }
  const checked = schema.safeParse(json);
  return checked.success ? { ok: true, value: checked.data } : { ok: false, reason: issuesOf(checked.error) };
}

interface JsonRequest<T> {
  system: string;
  input: unknown;
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Called once with the tokens of every attempt, also when the answer is refused, so spending is always counted. */
  onUsage: (usage: TokenUsage) => void;
}

/**
 * One JSON answer that must match `schema`. The model is sent the schema itself (as JSON Schema). An answer that
 * isn't JSON or doesn't match is sent back once with the exact problems; a second miss is refused, never shown.
 */
export async function askForJson<T>({
  system,
  input,
  schema,
  maxTokens,
  onUsage,
}: JsonRequest<T>): Promise<T> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}\n\nAnswer with one JSON object, and nothing else, matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`,
    },
    { role: "user", content: JSON.stringify(input) },
  ];
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const answer = await completeJson(messages, maxTokens);
      usage.promptTokens += answer.usage.promptTokens;
      usage.completionTokens += answer.usage.completionTokens;
      const result = parse(answer.content, schema);
      if (result.ok) return result.value;
      messages.push(
        { role: "assistant", content: answer.content },
        {
          role: "user",
          content: `That answer does not match the schema (${result.reason}). Send the corrected JSON object only.`,
        },
      );
    }
    throw unavailable("The AI's answer couldn't be used this time. Please try again.");
  } finally {
    onUsage(usage);
  }
}
