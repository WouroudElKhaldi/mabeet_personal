import { z } from "zod";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";
import type { AiTool } from "./tool";

// DeepSeek speaks the OpenAI chat-completions format, so swapping providers means changing this file only.

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const CHAT_TIMEOUT_MS = 45_000;
const JSON_TIMEOUT_MS = 90_000;
const MAX_CHAT_OUTPUT_TOKENS = 900;

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal("function"),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

// Tools are module-level constants, so each JSON Schema is built once per process, not on every model round.
const toolSpecs = new WeakMap<AiTool, object>();

function toToolSpec(tool: AiTool) {
  let spec = toolSpecs.get(tool);
  if (!spec) {
    spec = {
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input) },
    };
    toolSpecs.set(tool, spec);
  }
  return spec;
}

async function requestCompletion(body: Record<string, unknown>, timeoutMs: number) {
  if (!env.DEEPSEEK_API_KEY) throw unavailable("The assistant is not set up yet.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "content-type": "application/json", authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!response.ok) {
    console.error("DeepSeek error", response.status, await response.text().catch(() => ""));
    throw unavailable("The assistant is busy right now. Please try again in a moment.");
  }
  const { choices, usage } = completionSchema.parse(await response.json());
  return {
    message: choices[0]!.message,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
    } satisfies TokenUsage,
  };
}

/**
 * One chat round; the model may answer or ask for some of the offered tools. With `onText`, the answer is
 * streamed and `onText` gets the text written so far after each piece, so a person can watch it arrive.
 */
export function complete(
  messages: ChatMessage[],
  tools: readonly AiTool[],
  onText?: (textSoFar: string) => void,
) {
  const body = {
    messages,
    tools: tools.length > 0 ? tools.map(toToolSpec) : undefined,
    max_tokens: MAX_CHAT_OUTPUT_TOKENS,
    temperature: 0.3,
  };
  return onText ? streamCompletion(body, onText) : requestCompletion(body, CHAT_TIMEOUT_MS);
}

const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  id: z.string().nullish(),
                  function: z
                    .object({ name: z.string().nullish(), arguments: z.string().nullish() })
                    .nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
      }),
    )
    .default([]),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullish(),
});

/**
 * The same round as requestCompletion, read as Server-Sent Events. Text pieces are added up; tool calls arrive
 * in pieces too (id and name first, then the arguments a few characters at a time) and are put back together.
 */
async function streamCompletion(body: Record<string, unknown>, onText: (textSoFar: string) => void) {
  if (!env.DEEPSEEK_API_KEY) throw unavailable("The assistant is not set up yet.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    headers: { "content-type": "application/json", authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: MODEL, ...body, stream: true, stream_options: { include_usage: true } }),
  });
  if (!response.ok || !response.body) {
    console.error("DeepSeek error", response.status, await response.text().catch(() => ""));
    throw unavailable("The assistant is busy right now. Please try again in a moment.");
  }

  let content = "";
  const calls: ToolCall[] = [];
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
  for await (const data of serverSentEvents(response.body)) {
    if (data === "[DONE]") break;
    const chunk = chunkSchema.parse(JSON.parse(data));
    if (chunk.usage) {
      usage.promptTokens = chunk.usage.prompt_tokens;
      usage.completionTokens = chunk.usage.completion_tokens;
    }
    const delta = chunk.choices[0]?.delta;
    for (const piece of delta?.tool_calls ?? []) {
      const call = (calls[piece.index] ??= {
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      });
      if (piece.id) call.id = piece.id;
      call.function.name += piece.function?.name ?? "";
      call.function.arguments += piece.function?.arguments ?? "";
    }
    if (delta?.content) {
      content += delta.content;
      onText(content);
    }
  }
  const toolCalls = calls.filter(Boolean);
  return {
    message: { content: content || null, tool_calls: toolCalls.length > 0 ? toolCalls : undefined },
    usage,
  };
}

/** The `data:` payloads of an event stream, one per event. */
async function* serverSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    buffer += decoder.decode(read.value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

/** One answer as a JSON object (DeepSeek's JSON mode), for reports that the app lays out itself. */
export async function completeJson(messages: ChatMessage[], maxTokens: number) {
  const { message, usage } = await requestCompletion(
    { messages, max_tokens: maxTokens, temperature: 0.2, response_format: { type: "json_object" } },
    JSON_TIMEOUT_MS,
  );
  return { content: message.content ?? "{}", usage };
}
