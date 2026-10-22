import { z } from "zod";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";
import type { AiTool } from "./tool";

// DeepSeek speaks the OpenAI chat-completions format, so swapping providers means changing this file only.

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 900;

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

function toFunction(tool: AiTool) {
  return {
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input) },
  };
}

export async function complete(messages: ChatMessage[], tools: readonly AiTool[]) {
  if (!env.DEEPSEEK_API_KEY) throw unavailable("The assistant is not set up yet.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "content-type": "application/json", authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: tools.length > 0 ? tools.map(toFunction) : undefined,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    console.error("DeepSeek error", response.status, await response.text().catch(() => ""));
    throw unavailable("The assistant is busy right now. Please try again in a moment.");
  }
  const { choices, usage } = completionSchema.parse(await response.json());
  return {
    message: choices[0]!.message,
    usage: { promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 },
  };
}
