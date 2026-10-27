import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "Mabeet <hello@mabeet.app>" },
}));

const { sendEmail } = await import("@/server/email/send");

const email = { subject: "Confirmed", html: "<p>Hi</p>", text: "Hi" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stubResend = () => {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("sendEmail", () => {
  it("never calls Resend for addresses on reserved test domains", async () => {
    const fetch = stubResend();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendEmail({ ...email, to: ["host@mabeet.test", "guest@example.example"] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends only to the addresses that can receive email", async () => {
    const fetch = stubResend();
    await sendEmail({ ...email, to: ["owner@guesthouse.lb", "staff@mabeet.test"] });
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = fetch.mock.calls[0]!;
    const body = JSON.parse(String(init.body)) as { to: string[] };
    expect(body.to).toEqual(["owner@guesthouse.lb"]);
  });
});
