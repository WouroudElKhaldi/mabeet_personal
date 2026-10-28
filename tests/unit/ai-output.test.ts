import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// The model is scripted: each test queues the JSON answers DeepSeek would send, attempt by attempt.
const script = vi.hoisted(() => ({ answers: [] as string[], seen: [] as unknown[] }));
vi.mock("@/server/ai/deepseek", () => ({
  completeJson: vi.fn(async (messages: unknown[]) => {
    script.seen.push(structuredClone(messages));
    return { content: script.answers.shift() ?? "{}", usage: { promptTokens: 10, completionTokens: 5 } };
  }),
}));

const { askForJson, shapeReply } = await import("@/server/ai/output");

const schema = z.object({ title: z.string().min(1), score: z.number().int().min(0).max(10) });

beforeEach(() => {
  script.answers = [];
  script.seen = [];
});

describe("chat replies are shaped to the stated format", () => {
  it("keeps the markdown subset the app renders", () => {
    const reply =
      "**3 requests** are waiting:\n- SN-7KX3P9\n\n| Ref | Room |\n| --- | --- |\n| SN-7KX3P9 | Arched |";
    expect(shapeReply(reply)).toBe(reply);
  });

  it("drops HTML, code fences and links, and turns headings and stars into the subset", () => {
    expect(shapeReply("## Summary\n<b>Hi</b> [see](https://x.test)\n* one\n```json\n{}\n```")).toBe(
      "**Summary**\nHi see\n- one\n{}",
    );
  });

  it("returns an empty reply when nothing usable is left, so the screen shows its fallback", () => {
    expect(shapeReply("  <br/>  ")).toBe("");
    expect(shapeReply(null)).toBe("");
  });

  it("cuts an over-long reply at a line break", () => {
    const shaped = shapeReply(`${"word ".repeat(500)}\n${"more ".repeat(500)}`);
    expect(shaped.length).toBeLessThanOrEqual(4_002);
    expect(shaped.endsWith("…")).toBe(true);
  });
});

describe("JSON answers must match their schema", () => {
  it("sends the schema with the request and returns a matching answer", async () => {
    script.answers.push(JSON.stringify({ title: "Good month", score: 8 }));
    const onUsage = vi.fn();
    await expect(
      askForJson({ system: "Rate it", input: {}, schema, maxTokens: 100, onUsage }),
    ).resolves.toEqual({
      title: "Good month",
      score: 8,
    });
    const [system] = script.seen[0] as Array<{ content: string }>;
    expect(system!.content).toContain('"score"');
    expect(onUsage).toHaveBeenCalledWith({ promptTokens: 10, completionTokens: 5 });
  });

  it("sends a wrong answer back once with the exact problem, then accepts the fix", async () => {
    script.answers.push(
      JSON.stringify({ title: "Good month", score: 42 }),
      JSON.stringify({ title: "Ok", score: 4 }),
    );
    const onUsage = vi.fn();
    await expect(askForJson({ system: "s", input: {}, schema, maxTokens: 100, onUsage })).resolves.toEqual({
      title: "Ok",
      score: 4,
    });
    const retry = (script.seen[1] as Array<{ content: string }>).at(-1)!;
    expect(retry.content).toContain("score");
    expect(onUsage).toHaveBeenCalledWith({ promptTokens: 20, completionTokens: 10 });
  });

  it("refuses an answer that is still wrong, and still counts the tokens spent", async () => {
    script.answers.push("not json", JSON.stringify({ title: "", score: 1 }));
    const onUsage = vi.fn();
    await expect(askForJson({ system: "s", input: {}, schema, maxTokens: 100, onUsage })).rejects.toThrow(
      "couldn't be used",
    );
    expect(onUsage).toHaveBeenCalledWith({ promptTokens: 20, completionTokens: 10 });
  });
});

describe("money reaches the model already formatted", () => {
  it("turns every ...Cents next to or under a currency into a formatted amount", async () => {
    const { toolPayload } = await import("@/server/ai/run-tool");
    const payload = toolPayload({
      ok: true,
      result: [
        { currency: "USD", totalCents: 14_000, rooms: [{ nightlyRateCents: 3_550 }], depositCents: null },
      ],
    });
    expect(payload).toEqual([
      { currency: "USD", total: "$140", rooms: [{ nightlyRate: "$35.50" }], deposit: null },
    ]);
  });

  it("leaves amounts without a known currency as they are", async () => {
    const { toolPayload } = await import("@/server/ai/run-tool");
    expect(toolPayload({ ok: true, result: { baseRateCents: 9_000 } })).toEqual({ baseRateCents: 9_000 });
  });
});
