import type { z } from "zod";
import type { Permission } from "@/server/auth/permissions";

/**
 * One capability an AI may call, shared by the MCP servers and the DeepSeek chat.
 * Tools never take a businessId: the business always comes from the caller's key or session.
 */
export interface AiTool<Input extends z.ZodObject = z.ZodObject, Context = unknown> {
  name: string;
  description: string;
  input: Input;
  /** Tools a member lacks the permission for are not even offered to their AI. */
  requires?: Permission;
  /** Writes change data; clients are told so and read-only keys never see them. */
  mutates: boolean;
  // Method syntax on purpose: tools with narrower inputs or contexts can live in one list.
  run(input: z.infer<Input>, context: Context): Promise<unknown>;
}

export function defineTool<Input extends z.ZodObject, Context>(tool: AiTool<Input, Context>) {
  return tool;
}
