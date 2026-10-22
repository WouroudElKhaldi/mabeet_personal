import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: {
    WHISH_MODE: "sandbox",
    WHISH_CHANNEL: "channel-1",
    WHISH_SECRET: "secret-1",
    WHISH_WEBSITE_URL: "https://mabeet.example",
    BETTER_AUTH_URL: "https://mabeet.example",
    VAPID_SUBJECT: "mailto:hello@mabeet.example",
  },
}));

const { createWhishPayment, getWhishStatus, whishAmount } = await import("@/server/payments/whish");

const envelope = (data: unknown, status = true, code: string | null = null) =>
  new Response(JSON.stringify({ status, code, dialog: null, actions: null, extra: null, data }), {
    status: 200,
  });

afterEach(() => vi.unstubAllGlobals());

describe("Whish Pay client", () => {
  it("writes amounts the way Whish wants them", () => {
    expect(whishAmount(1250, "USD")).toBe("12.50");
    expect(whishAmount(150_000_000, "LBP")).toBe("1500000");
  });

  it("sends Whish's headers and body, and returns the collectUrl", async () => {
    const fetchMock = vi.fn(async () => envelope({ collectUrl: "https://whish.money/pay/abc" }));
    vi.stubGlobal("fetch", fetchMock);
    const url = await createWhishPayment({
      externalId: "pay_1",
      amountCents: 3000,
      currency: "USD",
      invoice: "Booking ABC",
      successCallbackUrl: "https://mabeet.example/cb",
      failureCallbackUrl: "https://mabeet.example/cb?attempt=failed",
      successRedirectUrl: "https://mabeet.example/b/t",
      failureRedirectUrl: "https://mabeet.example/b/t",
    });
    expect(url).toBe("https://whish.money/pay/abc");
    const [called, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(called).toBe("https://partner.api.sbx.whish.money/itel-service/api/payment/whish");
    expect(init.headers).toMatchObject({
      channel: "channel-1",
      secret: "secret-1",
      websiteUrl: "https://mabeet.example",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: "30.00",
      currency: "USD",
      externalId: "pay_1",
    });
  });

  it("reads the collect status, and treats code 500 (outcome unknown) as an error, never as paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope({ collectStatus: "success", payerPhoneNumber: "96170123456" })),
    );
    expect(await getWhishStatus("pay_1", "USD")).toEqual({ status: "success", payerPhone: "96170123456" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope(null, false, "500")),
    );
    await expect(getWhishStatus("pay_1", "USD")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
