import { describe, expect, it, vi } from "vitest";
import { isPushServiceUrl } from "@/server/push/send";

// The sender reads VAPID keys from the app's settings; this test needs none of them.
vi.mock("@/server/env", () => ({ env: {} }));

describe("push subscription endpoints", () => {
  it("accepts the browsers' own push services", () => {
    expect(isPushServiceUrl("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushServiceUrl("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushServiceUrl("https://web.push.apple.com/abc")).toBe(true);
  });

  it("refuses any other address, so a forged subscription cannot aim the server elsewhere", () => {
    expect(isPushServiceUrl("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushServiceUrl("https://fcm.googleapis.com.evil.test/abc")).toBe(false);
    expect(isPushServiceUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isPushServiceUrl("not a url")).toBe(false);
  });
});
