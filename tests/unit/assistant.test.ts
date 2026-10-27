import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineTool } from "@/server/ai/tool";

// The model is scripted: each test queues the replies DeepSeek would send, round by round.
const script = vi.hoisted(() => ({ replies: [] as unknown[] }));
vi.mock("@/server/ai/deepseek", () => ({
  complete: vi.fn(async () => ({
    message: script.replies.shift(),
    usage: { promptTokens: 10, completionTokens: 5 },
  })),
}));

const { runAssistant } = await import("@/server/ai/assistant");

const toolCall = (name: string, args: unknown) => ({
  content: null,
  tool_calls: [{ id: "call-1", type: "function", function: { name, arguments: JSON.stringify(args) } }],
});
const answer = (content: string) => ({ content });

const closeDates = defineTool({
  name: "close_dates",
  description: "Block nights",
  input: z.object({ room: z.string().max(80), checkIn: z.iso.date(), checkOut: z.iso.date() }),
  mutates: true,
  run: vi.fn(async () => ({ blockId: "block-1" })),
});
const listRooms = defineTool({
  name: "list_rooms",
  description: "Rooms",
  input: z.object({}),
  mutates: false,
  run: vi.fn(async () => [{ name: "Arched room" }]),
});
const tools = [closeDates, listRooms];

beforeEach(() => {
  script.replies = [];
  vi.mocked(closeDates.run).mockClear();
  vi.mocked(listRooms.run).mockClear();
});

describe("assistant changes wait for a person", () => {
  it("turns a write the model asks for into a proposal, and never runs it", async () => {
    const order = { room: "Arched room", checkIn: "2026-11-12", checkOut: "2026-11-15" };
    script.replies.push(toolCall("close_dates", order), answer("I'll close the Arched room; press Confirm."));
    const turn = await runAssistant({ system: "s", history: [], tools, context: null, proposeChanges: true });
    expect(closeDates.run).not.toHaveBeenCalled();
    expect(turn.proposals).toEqual([{ tool: "close_dates", input: order }]);
    expect(turn.reply).toContain("Confirm");
  });

  it("refuses a proposal whose input fails the tool's schema, so no card is shown", async () => {
    script.replies.push(
      toolCall("close_dates", { room: "Arched room", checkIn: "soon" }),
      answer("Which dates?"),
    );
    const turn = await runAssistant({ system: "s", history: [], tools, context: null, proposeChanges: true });
    expect(turn.proposals).toEqual([]);
    expect(turn.trace[0]?.outcome).toMatchObject({ ok: false });
  });

  it("still runs read-only tools straight away", async () => {
    script.replies.push(toolCall("list_rooms", {}), answer("You have the Arched room."));
    const turn = await runAssistant({ system: "s", history: [], tools, context: null, proposeChanges: true });
    expect(listRooms.run).toHaveBeenCalledOnce();
    expect(turn.proposals).toEqual([]);
  });

  it("runs writes directly only when proposals are off (the MCP clients ask the person themselves)", async () => {
    script.replies.push(
      toolCall("close_dates", { room: "Arched room", checkIn: "2026-11-12", checkOut: "2026-11-15" }),
      answer("Closed."),
    );
    await runAssistant({ system: "s", history: [], tools, context: null });
    expect(closeDates.run).toHaveBeenCalledOnce();
  });
});
