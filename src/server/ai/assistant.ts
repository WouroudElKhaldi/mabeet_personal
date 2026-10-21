import { type ChatMessage, complete } from "./deepseek";
import { runTool, type ToolOutcome } from "./run-tool";
import type { AiTool } from "./tool";

const MAX_TOOL_ROUNDS = 4;

export interface ToolTrace {
  tool: string;
  outcome: ToolOutcome;
}

export interface AssistantTurn {
  reply: string;
  trace: ToolTrace[];
}

interface AssistantOptions {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  tools: readonly AiTool[];
  context: unknown;
  onCall?: (tool: string, outcome: ToolOutcome, latencyMs: number) => Promise<unknown>;
}

/** The tool-calling loop: the model asks for tools, we run them with the caller's context, until it answers. */
export async function runAssistant({
  system,
  history,
  tools,
  context,
  onCall,
}: AssistantOptions): Promise<AssistantTurn> {
  const messages: ChatMessage[] = [{ role: "system", content: system }, ...history];
  const trace: ToolTrace[] = [];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const offered = round < MAX_TOOL_ROUNDS ? tools : [];
    const message = await complete(messages, offered);
    if (!message.tool_calls?.length) return { reply: message.content?.trim() ?? "", trace };

    messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      const tool = byName.get(call.function.name);
      const started = Date.now();
      const outcome: ToolOutcome = tool
        ? await runTool(tool, safeJson(call.function.arguments), context)
        : { ok: false, error: `Unknown tool ${call.function.name}` };
      await onCall?.(call.function.name, outcome, Date.now() - started);
      trace.push({ tool: call.function.name, outcome });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }),
      });
    }
  }
  return { reply: "", trace };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
