import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import type { AiTool } from "./tool";

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

/** Validates input, runs the tool and turns failures into messages that are safe to hand to a model. */
export async function runTool(tool: AiTool, rawInput: unknown, context: unknown): Promise<ToolOutcome> {
  try {
    const input = tool.input.parse(rawInput ?? {});
    return { ok: true, result: await tool.run(input, context) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    if (error instanceof ZodError)
      return {
        ok: false,
        error: `Invalid arguments: ${error.issues.map((issue) => issue.message).join("; ")}`,
      };
    console.error(error);
    return { ok: false, error: "The tool failed. Try again or ask the user." };
  }
}
