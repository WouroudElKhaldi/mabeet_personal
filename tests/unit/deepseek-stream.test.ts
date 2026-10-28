import { afterEach, describe, expect, it, vi } from "vitest";

// DeepSeek streams an answer as Server-Sent Events. The network splits them anywhere, even mid-line, and tool calls
// arrive in pieces; the client must put both back together exactly.

vi.mock("@/server/env", () => ({ env: { DEEPSEEK_API_KEY: "test-key" } }));

const { complete } = await import("@/server/ai/deepseek");

const event = (payload: object | string) =>
  `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;

/** A response body delivered in the given pieces, as a slow network would. */
function streamOf(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** Cuts the whole stream every `size` characters, ignoring line ends. */
const cut = (text: string, size: number) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [];

afterEach(() => vi.unstubAllGlobals());

describe("streamed completions", () => {
  it("adds up the text, tells the listener each time, and reads the usage", async () => {
    const wire =
      event({ choices: [{ delta: { content: "Two lodges " } }] }) +
      event({ choices: [{ delta: { content: "are free." } }] }) +
      event({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 6 } }) +
      event("[DONE]");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamOf(cut(wire, 7))),
    );
    const seen: string[] = [];

    const { message, usage } = await complete([{ role: "user", content: "hi" }], [], (text) =>
      seen.push(text),
    );

    expect(message).toEqual({ content: "Two lodges are free.", tool_calls: undefined });
    expect(seen).toEqual(["Two lodges ", "Two lodges are free."]);
    expect(usage).toEqual({ promptTokens: 120, completionTokens: 6 });
  });

  it("puts a tool call back together from its pieces, and writes no text for it", async () => {
    const wire =
      event({
        choices: [
          { delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "search_places" } }] } },
        ],
      }) +
      event({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"area":' } }] } }] }) +
      event({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Faraya"}' } }] } }] }) +
      event("[DONE]");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamOf(cut(wire, 11))),
    );
    const onText = vi.fn();

    const { message } = await complete([{ role: "user", content: "Faraya?" }], [], onText);

    expect(message.content).toBeNull();
    expect(message.tool_calls).toEqual([
      { id: "call_1", type: "function", function: { name: "search_places", arguments: '{"area":"Faraya"}' } },
    ]);
    expect(onText).not.toHaveBeenCalled();
  });

  it("asks DeepSeek to stream, with usage, only when someone is listening", async () => {
    const fetchMock = vi.fn(async () => streamOf([event("[DONE]")]));
    vi.stubGlobal("fetch", fetchMock);
    await complete([{ role: "user", content: "hi" }], [], () => undefined);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });
});
