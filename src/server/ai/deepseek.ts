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

/** One chat round; the model may answer or ask for some of the offered tools. */
export function complete(messages: ChatMessage[], tools: readonly AiTool[]) {
  return requestCompletion(
    {
      messages,
      tools: tools.length > 0 ? tools.map(toToolSpec) : undefined,
      max_tokens: MAX_CHAT_OUTPUT_TOKENS,
      temperature: 0.3,
    },
    CHAT_TIMEOUT_MS,
  );
}

/** One answer as a JSON object (DeepSeek's JSON mode), for reports that the app lays out itself. */
export async function completeJson(messages: ChatMessage[], maxTokens: number) {
  const { message, usage } = await requestCompletion(
    { messages, max_tokens: maxTokens, temperature: 0.2, response_format: { type: "json_object" } },
    JSON_TIMEOUT_MS,
  );
  return { content: message.content ?? "{}", usage };
}
