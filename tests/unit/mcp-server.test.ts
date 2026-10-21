import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handleMcpRequest } from "@/server/ai/mcp-server";
import { defineTool } from "@/server/ai/tool";
import { AppError } from "@/server/errors";

const echo = defineTool({
  name: "echo",
  description: "Echoes a word",
  input: z.object({ word: z.string().max(10) }),
  mutates: false,
  run: async ({ word }: { word: string }, context: { tenant: string }) => ({ word, tenant: context.tenant }),
});

const forbidden = defineTool({
  name: "secret",
  description: "Always refuses",
  input: z.object({}),
  mutates: true,
  run: async () => {
    throw new AppError("FORBIDDEN", "Missing permission: bookings.decide");
  },
});

async function rpc(method: string, params: unknown) {
  const request = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const response = await handleMcpRequest(request, {
    name: "test",
    instructions: "test",
    tools: [echo, forbidden],
    context: { tenant: "A" },
  });
  return (await response.json()) as { result: Record<string, unknown> };
}

describe("MCP server", () => {
  it("lists tools with read-only and destructive hints", async () => {
    const { result } = await rpc("tools/list", {});
    const tools = result.tools as Array<{ name: string; annotations: Record<string, boolean> }>;
    expect(tools.map((tool) => tool.name)).toEqual(["echo", "secret"]);
    expect(tools[0]?.annotations.readOnlyHint).toBe(true);
    expect(tools[1]?.annotations.destructiveHint).toBe(true);
  });

  it("runs a tool with the caller's context", async () => {
    const { result } = await rpc("tools/call", { name: "echo", arguments: { word: "salam" } });
    expect(result.isError).toBe(false);
    expect(JSON.parse((result.content as Array<{ text: string }>)[0]!.text)).toEqual({
      word: "salam",
      tenant: "A",
    });
  });

  it("returns domain errors as tool errors without leaking internals", async () => {
    const { result } = await rpc("tools/call", { name: "secret", arguments: {} });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain("Missing permission");
  });
});
