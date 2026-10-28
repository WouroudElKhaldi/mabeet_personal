import { type ChatMessage, complete, type TokenUsage } from "./deepseek";
import { REPLY_FORMAT, shapeReply } from "./output";
import { createToolRunner, type ToolCallListener, type ToolOutcome, toolPayload } from "./run-tool";
import type { AiTool } from "./tool";

const MAX_TOOL_ROUNDS = 4;

interface ToolTrace {
  tool: string;
  outcome: ToolOutcome;
}

/** A change the model asked for, with input that already passed the tool's schema. Run only once a person confirms. */
export interface ProposedAction {
  tool: string;
  input: Record<string, unknown>;
}

export interface AssistantTurn {
  /** Already in REPLY_FORMAT; "" when the model gave nothing usable, so the screen shows its own fallback. */
  reply: string;
  trace: ToolTrace[];
  /** Changes waiting for the person's confirmation; always empty without `proposeChanges`. */
  proposals: ProposedAction[];
  /** Summed over every model call in this turn. */
  usage: TokenUsage;
}

interface AssistantOptions {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  tools: readonly AiTool[];
  context: unknown;
  onCall?: ToolCallListener;
  /**
   * Tools that change data are never run here: their validated input is returned as a proposal for a person to
   * confirm. Without it, only offer read-only tools. Either way, the calls of one round run in parallel, which is
   * safe because nothing in a round writes.
   */
  proposeChanges?: boolean;
  /** Told what is happening while the turn runs: the tool in use, then the reply so far (raw, not yet shaped). */
  onProgress?: (progress: TurnProgress) => void;
}

/** What a person can be shown before the answer is ready. `step` names the tool while tools run; `text` while it writes. */
export interface TurnProgress {
  step: string | null;
  text: string;
}

const AWAITING_CONFIRMATION = {
  status: "awaiting_confirmation",
  note: "Nothing has changed yet. Say exactly what will happen; the member confirms it with the button under your reply. Never say it is done.",
};

/**
 * The tool-calling loop: the model asks for tools, we run them with the caller's context, until it answers. The
 * reply format is added to every system prompt, and every reply is shaped to it before it leaves.
 */
export async function runAssistant({
  system,
  history,
  tools,
  context,
  onCall,
  proposeChanges = false,
  onProgress,
}: AssistantOptions): Promise<AssistantTurn> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}

${REPLY_FORMAT}`,
    },
    ...history,
  ];
  const trace: ToolTrace[] = [];
  const proposals: ProposedAction[] = [];
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
  const runTool = createToolRunner(tools, context, onCall);
  const writeTools = new Map(tools.filter((tool) => tool.mutates).map((tool) => [tool.name, tool]));

  /** A write tool becomes a proposal (if its input is valid); anything else runs now. */
  const handle = async (name: string, rawInput: unknown): Promise<ToolOutcome> => {
    const writer = proposeChanges ? writeTools.get(name) : undefined;
    if (!writer) return runTool(name, rawInput);
    const parsed = writer.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid arguments: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      };
    }
    proposals.push({ tool: name, input: parsed.data as Record<string, unknown> });
    return { ok: true, result: AWAITING_CONFIRMATION };
  };

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    // The last round offers no tools, so the model has to answer with what it has.
    const offered = round < MAX_TOOL_ROUNDS ? tools : [];
    const streamText = onProgress && ((text: string) => onProgress({ step: null, text }));
    const { message, usage: roundUsage } = await complete(messages, offered, streamText);
    usage.promptTokens += roundUsage.promptTokens;
    usage.completionTokens += roundUsage.completionTokens;
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return { reply: shapeReply(message.content), trace, proposals, usage };

    // Any words written before asking for tools are dropped from view: the real reply comes after the tools.
    onProgress?.({ step: calls[0]!.function.name, text: "" });
    messages.push({ role: "assistant", content: message.content, tool_calls: calls });
    const outcomes = await Promise.all(
      calls.map((call) => handle(call.function.name, parseArguments(call.function.arguments))),
    );
    calls.forEach((call, index) => {
      const outcome = outcomes[index]!;
      trace.push({ tool: call.function.name, outcome });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(toolPayload(outcome)) });
    });
  }
  return { reply: "", trace, proposals, usage };
}

/** Models sometimes send broken JSON; an empty object then fails the tool's own validation with a clear message. */
function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
