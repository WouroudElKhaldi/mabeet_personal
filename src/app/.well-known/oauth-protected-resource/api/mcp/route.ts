import { mcpResourceMetadata } from "@/server/auth/mcp-token";

/** RFC 9728: tells AI apps which authorization server issues tokens for the host MCP server. */
export async function GET() {
  return Response.json(await mcpResourceMetadata(), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
  });
}
