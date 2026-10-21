import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { BRAND } from "@/config/brand";
import { runTool, type ToolOutcome } from "./run-tool";
import type { AiTool } from "./tool";

interface McpOptions {
  name: string;
  instructions: string;
  tools: readonly AiTool[];
  context: unknown;
  onCall?: (tool: string, outcome: ToolOutcome, latencyMs: number) => Promise<unknown>;
}

/**
 * Answers one MCP request over Streamable HTTP, statelessly: a fresh server per request,
 * registered with only the tools this caller may use.
 */
export async function handleMcpRequest(request: Request, options: McpOptions): Promise<Response> {
  const server = new McpServer(
    { name: `${BRAND.name.toLowerCase()}-${options.name}`, version: "1.0.0" },
    { instructions: options.instructions },
  );

  for (const tool of options.tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input.shape,
        annotations: { readOnlyHint: !tool.mutates, destructiveHint: tool.mutates, openWorldHint: false },
      },
      async (args: unknown) => {
        const started = Date.now();
        const outcome = await runTool(tool, args, options.context);
        await options.onCall?.(tool.name, outcome, Date.now() - started);
        const payload = outcome.ok ? outcome.result : { error: outcome.error };
        return {
          isError: !outcome.ok,
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
        };
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "This MCP endpoint is stateless; use POST." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });
}
